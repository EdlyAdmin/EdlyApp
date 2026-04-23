import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

function parseStr(val: any): string {
  return val != null ? String(val).trim() : ''
}

// Extraherar ämnen ur fritext, t.ex. "Engelska och Svenska (högstadie)"
function parseSubjects(raw: string): string[] {
  const text = raw.toLowerCase()
  if (text.includes('alla ämnen') || text.includes('alla amnen')) {
    return ['svenska', 'matte', 'engelska']
  }
  const subjects: string[] = []
  if (text.includes('svenska')) subjects.push('svenska')
  if (text.includes('matte') || text.includes('matematik')) subjects.push('matte')
  if (text.includes('engelska')) subjects.push('engelska')
  return subjects
}

// Extraherar åldersgrupper ur fritext, t.ex. "år 7-9", "Fsk-7an", "högstadiet"
function parseAgeGroups(raw: string): string[] {
  const text = raw.toLowerCase()
  const groups = new Set<string>()

  // Explicita skolnivåer
  if (text.includes('lågstadie')) groups.add('F-9')
  if (text.includes('mellanstadie')) groups.add('10-12')
  if (text.includes('högstadie') || text.includes('hogstadie')) groups.add('13-15')
  if (text.includes('gymnasium') || text.includes('gymnasie')) groups.add('13-15')

  // Fsk / förskoleklass → yngsta gruppen
  if (text.includes('fsk') || text.includes('förskoleklass')) groups.add('F-9')

  // "Fsk-N" eller "F-N" som range (t.ex. "Fsk-7an")
  const fskRange = text.match(/(?:fsk|f)-(\d+)/)
  if (fskRange) {
    const end = parseInt(fskRange[1])
    groups.add('F-9')
    if (end >= 4) groups.add('10-12')
    if (end >= 7) groups.add('13-15')
  }

  // Hitta årkurs-siffror och intervall, t.ex. "år 7-9", "4-9", "3-9", "7an"
  const gradeRe = /(?:år\s*)?(\d+)(?:\s*[-–]\s*(\d+))?/g
  let m: RegExpExecArray | null
  while ((m = gradeRe.exec(text)) !== null) {
    const from = parseInt(m[1])
    const to = m[2] ? parseInt(m[2]) : from
    for (let g = from; g <= to; g++) {
      if (g <= 3) groups.add('F-9')
      else if (g <= 6) groups.add('10-12')
      else groups.add('13-15')
    }
  }

  return [...groups]
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
    let created = 0
    let skipped = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = parseStr(row[0])
      const phone = parseStr(row[1]) || null
      const email = parseStr(row[2]).toLowerCase()
      const subjectsRaw = parseStr(row[3])

      // Hoppa över tomma rader och rubrikraden
      if (!name || !email || email === 'epost' || email === 'e-post') continue

      const subjects = parseSubjects(subjectsRaw)
      if (subjects.length === 0) {
        errors.push(`Rad ${i + 1} (${name}): Inga giltiga ämnen i "${subjectsRaw}".`)
        continue
      }

      const ageGroups = parseAgeGroups(subjectsRaw)

      // Kontrollera om läraren redan finns
      const { data: existing } = await service.from('teachers').select('id').eq('email', email).single()
      if (existing) { skipped++; continue }

      const { error: insertErr } = await service.from('teachers').insert({
        name,
        email,
        phone,
        subjects_can: subjects,
        subjects_blocked: [],
        age_groups: ageGroups,
        max_groups: 2,
        status: 'approved',
      })

      if (insertErr) {
        errors.push(`Rad ${i + 1} (${name}): ${insertErr.message}`)
      } else {
        created++
      }
    }

    return NextResponse.json({ success: true, created, skipped, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
