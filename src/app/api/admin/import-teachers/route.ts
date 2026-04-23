import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const SUBJECT_MAP: Record<string, string> = {
  svenska: 'svenska',
  matte: 'matte',
  matematik: 'matte',
  engelska: 'engelska',
}

function parseSubjects(raw: string): string[] {
  return raw
    .split(/[,/]/)
    .map(s => s.trim().toLowerCase().replace(/\s+f-\d+/g, '').trim())
    .map(s => SUBJECT_MAP[s])
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) // unika
}

function parseStr(val: any): string {
  return val != null ? String(val).trim() : ''
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
    // Läs som råa arrayer, hoppa över rubrikrad och tomrad
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
      if (!name || !email || email === 'epost') continue

      const subjects = parseSubjects(subjectsRaw)
      if (subjects.length === 0) {
        errors.push(`Rad ${i + 1} (${name}): Inga giltiga ämnen i "${subjectsRaw}".`)
        continue
      }

      // Kontrollera om läraren redan finns
      const { data: existing } = await service.from('teachers').select('id').eq('email', email).single()
      if (existing) { skipped++; continue }

      const { error: insertErr } = await service.from('teachers').insert({
        name,
        email,
        phone,
        subjects_can: subjects,
        subjects_blocked: [],
        age_groups: [],
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
