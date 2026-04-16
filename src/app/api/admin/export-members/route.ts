import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

function calcAge(birthdate: string) {
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
}

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska',
  matte: 'Matematik',
  engelska: 'Engelska',
}

const DIAGNOSIS_LABELS: Record<string, string> = {
  dyslexi: 'Dyslexi',
  dyskalkyli: 'Dyskalkyli',
  adhd: 'ADHD',
  autism: 'Autism',
  sprakstorning: 'Språkstörning',
  annat: 'Annat',
}

export async function GET() {
  try {
  // Verifiera admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  // Hämta alla barn med familjeinfo och matchstatus
  const { data: children, error: childrenError } = await service
    .from('children')
    .select(`
      id, name, birthdate, subjects, diagnoses, diagnosis_other,
      membership_consented_at, created_at,
      families(parent_name, email),
      group_members(group_id)
    `)
    .order('created_at', { ascending: true })

  if (childrenError) {
    return NextResponse.json({ error: childrenError.message }, { status: 500 })
  }

  // Normalisera group_members till array (Supabase returnerar objekt vid enstaka rad)
  const toArr = (v: any) => !v ? [] : Array.isArray(v) ? v : [v]

  // Hämta lärare och status för matchade barn
  const groupIds = (children ?? [])
    .flatMap((c: any) => toArr(c.group_members).map((gm: any) => gm.group_id))
    .filter(Boolean)

  const { data: groups } = groupIds.length
    ? await service.from('groups').select('id, teacher_id, status').in('id', groupIds)
    : { data: [] }

  const teacherIds = [...new Set((groups ?? []).map((g: any) => g.teacher_id))]
  const { data: teachers } = teacherIds.length
    ? await service.from('teachers').select('id, name').in('id', teacherIds)
    : { data: [] }

  const teacherById: Record<string, string> = {}
  for (const t of teachers ?? []) teacherById[t.id] = t.name

  const groupById: Record<string, { teacherName: string; status: string }> = {}
  for (const g of groups ?? []) {
    groupById[g.id] = { teacherName: teacherById[g.teacher_id] ?? '', status: g.status }
  }

  // Bygg rader
  const rows = (children ?? []).map((c: any) => {
    const members = toArr(c.group_members)

    let status = 'I kön'
    let teacherName = ''

    if (members.length > 0) {
      const group = groupById[members[0].group_id]
      if (group?.status === 'active') {
        status = 'Aktiv'
        teacherName = group.teacherName
      } else if (group?.status === 'full') {
        status = 'Inväntar godkännande'
        teacherName = group.teacherName
      } else if (group?.status === 'forming') {
        status = 'Tilldelad grupp'
        teacherName = group.teacherName
      }
    }

    const diagnoses = (c.diagnoses ?? []).map((d: string) => DIAGNOSIS_LABELS[d] ?? d)
    if (c.diagnosis_other) diagnoses.push(c.diagnosis_other)

    return {
      'Förälder': c.families?.parent_name ?? '',
      'Förälderns e-post': c.families?.email ?? '',
      'Barnets namn': c.name,
      'Födelsedatum': c.birthdate,
      'Ålder': calcAge(c.birthdate),
      'Ämnen': (c.subjects ?? []).map((s: string) => SUBJECT_LABELS[s] ?? s).join(', '),
      'Diagnos': diagnoses.join(', '),
      'Status': status,
      'Lärare': teacherName,
      'Medlem sedan': c.membership_consented_at
        ? new Date(c.membership_consented_at).toLocaleDateString('sv-SE')
        : '',
      'Registrerad': new Date(c.created_at).toLocaleDateString('sv-SE'),
    }
  })

  // Skapa Excel-fil
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Sätt kolumnbredder
  ws['!cols'] = [
    { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 14 },
    { wch: 8 },  { wch: 20 }, { wch: 28 }, { wch: 18 },
    { wch: 20 }, { wch: 16 }, { wch: 14 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Medlemmar')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="edly-medlemmar-${today}.xlsx"`,
    },
  })
  } catch (err: any) {
    console.error('export-members error:', err)
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
