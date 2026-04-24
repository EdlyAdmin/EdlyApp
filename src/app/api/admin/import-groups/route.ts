import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

function parseStr(val: any): string {
  return val != null ? String(val).trim() : ''
}

function normalizeSubject(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  if (s === 'svenska') return 'svenska'
  if (s === 'matte' || s === 'matematik') return 'matte'
  if (s === 'engelska') return 'engelska'
  return null
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
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    const errors: string[] = []
    let groupsCreated = 0

    // Gruppera rader: läraren förs vidare tills ny sätts
    interface GroupRow { teacherName: string; childName: string; parentEmail: string; subject: string }
    const groupBlocks: GroupRow[][] = []
    let currentBlock: GroupRow[] = []
    let currentTeacher = ''

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const teacher = parseStr(row[0])
      const childName = parseStr(row[1])
      const parentEmail = parseStr(row[2]).toLowerCase().trim()
      const subject = parseStr(row[4])

      if (!childName && !parentEmail) {
        // Tom rad — avsluta block
        if (currentBlock.length > 0) { groupBlocks.push(currentBlock); currentBlock = [] }
        currentTeacher = ''
        continue
      }

      if (teacher) {
        // Ny lärare → nytt block
        if (currentBlock.length > 0) groupBlocks.push(currentBlock)
        currentBlock = []
        currentTeacher = teacher
      }

      if (!parentEmail) { errors.push(`Rad ${i + 1} (${childName}): förälderns e-post saknas.`); continue }

      currentBlock.push({ teacherName: currentTeacher, childName, parentEmail, subject })
    }
    if (currentBlock.length > 0) groupBlocks.push(currentBlock)

    // Skapa grupper
    for (const block of groupBlocks) {
      if (block.length === 0) continue
      const teacherName = block[0].teacherName
      const subjectRaw = block[0].subject
      const subject = normalizeSubject(subjectRaw)

      if (!teacherName) { errors.push(`Grupp utan lärarnamn hoppades över.`); continue }
      if (!subject) { errors.push(`Grupp (${teacherName}): Okänt ämne "${subjectRaw}".`); continue }

      // Hitta läraren via namn
      const { data: teachers } = await service.from('teachers').select('id').ilike('name', teacherName)
      if (!teachers || teachers.length === 0) {
        errors.push(`Läraren "${teacherName}" hittades inte i systemet.`)
        continue
      }
      const teacherId = teachers[0].id

      // Skapa gruppen
      const { data: group, error: grpErr } = await service
        .from('groups')
        .insert({ teacher_id: teacherId, status: 'forming', subject })
        .select('id').single()

      if (grpErr) { errors.push(`Grupp (${teacherName}): ${grpErr.message}`); continue }
      groupsCreated++

      // Lägg till barn
      for (const row of block) {
        // Hitta familj via e-post
        const { data: family } = await service.from('families').select('id').eq('email', row.parentEmail).single()
        if (!family) {
          errors.push(`Barn "${row.childName}": Familj med e-post "${row.parentEmail}" hittades inte.`)
          continue
        }

        // Hitta barn i familjen, matcha på namn om möjligt
        const { data: children } = await service
          .from('children')
          .select('id, name')
          .eq('family_id', family.id)

        if (!children || children.length === 0) {
          errors.push(`Barn "${row.childName}": Inga barn hittades för familj "${row.parentEmail}".`)
          continue
        }

        let child = children.find(c =>
          c.name.toLowerCase().includes(row.childName.toLowerCase()) ||
          row.childName.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
        ) ?? (children.length === 1 ? children[0] : null)

        if (!child) {
          errors.push(`Barn "${row.childName}": Kunde inte matcha mot barn i familj "${row.parentEmail}" (${children.map(c => c.name).join(', ')}).`)
          continue
        }

        const { error: memberErr } = await service
          .from('group_members')
          .insert({ group_id: group.id, child_id: child.id })

        if (memberErr) {
          errors.push(`Barn "${child.name}": ${memberErr.message}`)
        }
      }
    }

    return NextResponse.json({ success: true, groupsCreated, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
