import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const VALID_SUBJECTS = ['svenska', 'matte', 'engelska']
const VALID_DIAGNOSES = ['dyslexi', 'dyskalkyli', 'adhd', 'autism', 'sprakstorning', 'annat']
const VALID_AGE_GROUPS = ['F-9', '10-12', '13-15']
const VALID_STATUSES = ['active', 'forming', 'full']

function parseList(val: any): string[] {
  if (!val) return []
  return String(val).split(',').map(s => s.trim()).filter(Boolean)
}

function parseStr(val: any): string {
  return val != null ? String(val).trim() : ''
}

// Normaliserar diagnos-strängar till systemets interna värden
const DIAGNOSIS_ALIASES: Record<string, string> = {
  sprakstorning: 'sprakstorning',
  språkstörning: 'sprakstorning',
  sprakstörning: 'sprakstorning',
  add: 'adhd',
  övrigt: 'annat',
  ovrigt: 'annat',
  if: 'annat',
}

function normalizeDiagnosis(raw: string): string {
  const lower = raw.toLowerCase().trim()
  // Ersätt svenska tecken för att matcha interna värden
  const ascii = lower.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
  return DIAGNOSIS_ALIASES[lower] ?? DIAGNOSIS_ALIASES[ascii] ?? lower
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Ingen fil uppladdad.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })

    const sheetBarn = wb.Sheets['Barn']
    const sheetLarare = wb.Sheets['Lärare']
    const sheetGrupper = wb.Sheets['Grupper']

    if (!sheetBarn || !sheetLarare) {
      return NextResponse.json({ error: 'Filen måste ha flikar "Barn" och "Lärare".' }, { status: 400 })
    }

    const barnRows: any[] = XLSX.utils.sheet_to_json(sheetBarn, { defval: '' })
    const lararRows: any[] = XLSX.utils.sheet_to_json(sheetLarare, { defval: '' })
    const gruppRows: any[] = sheetGrupper ? XLSX.utils.sheet_to_json(sheetGrupper, { defval: '' }) : []

    const errors: string[] = []
    let teachersCreated = 0
    let childrenCreated = 0
    let groupsCreated = 0

    // --- Importera lärare ---
    const teacherByEmail: Record<string, string> = {}

    for (let i = 0; i < lararRows.length; i++) {
      const row = lararRows[i]
      const rowNum = i + 2
      const name = parseStr(row['Namn'])
      const email = parseStr(row['E-post'])
      const phone = parseStr(row['Telefon']) || null
      const subjectsCan = parseList(row['Kan undervisa i']).filter(s => VALID_SUBJECTS.includes(s))
      const ageGroups = parseList(row['Åldersgrupper']).filter(a => VALID_AGE_GROUPS.includes(a))
      const maxGroups = parseInt(String(row['Max grupper'])) || 2

      if (!name || !email) { errors.push(`Lärare rad ${rowNum}: Namn och e-post krävs.`); continue }

      const { data: existing } = await service.from('teachers').select('id').eq('email', email).single()
      if (existing) {
        teacherByEmail[email] = existing.id
        continue
      }

      const { data: teacher, error } = await service.from('teachers').insert({
        name, email, phone,
        subjects_can: subjectsCan,
        subjects_blocked: [],
        age_groups: ageGroups,
        max_groups: maxGroups,
        status: 'approved',
      }).select('id').single()

      if (error) { errors.push(`Lärare rad ${rowNum} (${name}): ${error.message}`); continue }
      teacherByEmail[email] = teacher.id
      teachersCreated++
    }

    // --- Importera barn ---
    const childByName: Record<string, string> = {}

    for (let i = 0; i < barnRows.length; i++) {
      const row = barnRows[i]
      const rowNum = i + 2
      const childName = parseStr(row['Barnets namn'])
      const birthdate = parseStr(row['Födelsedatum (ÅÅÅÅ-MM-DD)']) || parseStr(row['Födelsedatum'])
      const subjectRaw = parseStr(row['Ämne']).toLowerCase()
      const subject = VALID_SUBJECTS.includes(subjectRaw) ? subjectRaw : null
      const diagnosRaw = parseList(row['Diagnos']).map(normalizeDiagnosis)
      const diagnoses = diagnosRaw.filter(d => VALID_DIAGNOSES.includes(d))
      const diagnosisOther = diagnosRaw.filter(d => !VALID_DIAGNOSES.includes(d)).join(', ') || null
      const extraInfo = parseStr(row['Övrig info']) || null
      const parentName = parseStr(row['Förälderns namn'])
      const parentEmail = parseStr(row['Förälderns e-post'])

      if (!childName || !parentEmail) { errors.push(`Barn rad ${rowNum}: Barnets namn och förälderns e-post krävs.`); continue }
      if (!subject) { errors.push(`Barn rad ${rowNum} (${childName}): Ogiltigt ämne "${subjectRaw}". Använd: svenska, matte eller engelska.`); continue }

      // Skapa eller hämta familj
      let familyId: string
      const { data: existingFamily } = await service.from('families').select('id').eq('email', parentEmail).single()
      if (existingFamily) {
        familyId = existingFamily.id
      } else {
        const { data: family, error: famErr } = await service.from('families').insert({
          parent_name: parentName, email: parentEmail,
        }).select('id').single()
        if (famErr) { errors.push(`Barn rad ${rowNum} (${childName}): Kunde inte skapa familj — ${famErr.message}`); continue }
        familyId = family.id
      }

      // Kontrollera om barnet redan finns
      const { data: existingChild } = await service.from('children').select('id').eq('name', childName).eq('family_id', familyId).single()
      if (existingChild) {
        childByName[childName] = existingChild.id
        continue
      }

      // Fullständigt datum → använd det, bara år (t.ex. "2026") → lägg till -01-01, annars platshållare
      const validBirthdate = /^\d{4}-\d{2}-\d{2}$/.test(birthdate)
        ? birthdate
        : /^\d{4}$/.test(birthdate)
          ? `${birthdate}-01-01`
          : '2000-01-01'

      const { data: child, error: childErr } = await service.from('children').insert({
        name: childName,
        birthdate: validBirthdate,
        subjects: [subject],
        diagnoses,
        diagnosis_other: diagnosisOther,
        extra_info: extraInfo,
        family_id: familyId,
      }).select('id').single()

      if (childErr) { errors.push(`Barn rad ${rowNum} (${childName}): ${childErr.message}`); continue }
      childByName[childName] = child.id
      childrenCreated++
    }

    // --- Importera grupper ---
    if (gruppRows.length > 0) {
      // Gruppera rader per Grupp-ID
      const gruppMap: Record<string, { teacherEmail: string; children: string[]; status: string }> = {}
      for (let i = 0; i < gruppRows.length; i++) {
        const row = gruppRows[i]
        const rowNum = i + 2
        const groupId = parseStr(row['Grupp-ID'])
        const teacherEmail = parseStr(row['Lärarens e-post'])
        const childName = parseStr(row['Barnets namn'])
        const statusRaw = parseStr(row['Status']).toLowerCase()
        const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'forming'

        if (!groupId || !teacherEmail || !childName) {
          errors.push(`Grupper rad ${rowNum}: Grupp-ID, lärarens e-post och barnets namn krävs.`)
          continue
        }

        if (!gruppMap[groupId]) {
          gruppMap[groupId] = { teacherEmail, children: [], status }
        }
        gruppMap[groupId].children.push(childName)
      }

      for (const [excelGroupId, grp] of Object.entries(gruppMap)) {
        const teacherId = teacherByEmail[grp.teacherEmail]
        if (!teacherId) { errors.push(`Grupp ${excelGroupId}: Läraren "${grp.teacherEmail}" hittades inte.`); continue }

        // Bestäm ämne från första barnets subjects
        const firstChildId = childByName[grp.children[0]]
        let subject: string | null = null
        if (firstChildId) {
          const { data: c } = await service.from('children').select('subjects').eq('id', firstChildId).single()
          subject = (c?.subjects as string[])?.[0] ?? null
        }

        const { data: group, error: grpErr } = await service.from('groups').insert({
          teacher_id: teacherId,
          status: grp.status,
          subject,
        }).select('id').single()

        if (grpErr) { errors.push(`Grupp ${excelGroupId}: ${grpErr.message}`); continue }
        groupsCreated++

        for (const childName of grp.children) {
          const childId = childByName[childName]
          if (!childId) { errors.push(`Grupp ${excelGroupId}: Barnet "${childName}" hittades inte bland importerade barn.`); continue }
          await service.from('group_members').insert({ group_id: group.id, child_id: childId })
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: { teachersCreated, childrenCreated, groupsCreated },
      errors,
    })
  } catch (err: any) {
    console.error('import error:', err)
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
