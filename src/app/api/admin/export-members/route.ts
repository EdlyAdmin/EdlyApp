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
  // Verifiera admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const service = createServiceClient()

  // Hämta alla barn med familjeinfo och matchstatus
  const { data: children } = await service
    .from('children')
    .select(`
      id, name, birthdate, subjects, diagnoses, diagnosis_other,
      membership_consented_at, created_at,
      families(parent_name, email),
      group_members(group_id),
      match_proposals(status)
    `)
    .order('created_at', { ascending: true })

  // Hämta lärare för matchade barn
  const groupIds = (children ?? [])
    .flatMap((c: any) => c.group_members?.map((gm: any) => gm.group_id) ?? [])
    .filter(Boolean)

  const { data: groups } = groupIds.length
    ? await service.from('groups').select('id, teacher_id').in('id', groupIds)
    : { data: [] }

  const teacherIds = [...new Set((groups ?? []).map((g: any) => g.teacher_id))]
  const { data: teachers } = teacherIds.length
    ? await service.from('teachers').select('id, name').in('id', teacherIds)
    : { data: [] }

  const teacherById: Record<string, string> = {}
  for (const t of teachers ?? []) teacherById[t.id] = t.name

  const groupById: Record<string, string> = {}
  for (const g of groups ?? []) groupById[g.id] = teacherById[g.teacher_id] ?? ''

  // Bygg rader
  const rows = (children ?? []).map((c: any) => {
    const proposals = Array.isArray(c.match_proposals) ? c.match_proposals : (c.match_proposals ? [c.match_proposals] : [])
    const members = Array.isArray(c.group_members) ? c.group_members : (c.group_members ? [c.group_members] : [])

    let status = 'I kön'
    let teacherName = ''

    if (members.length > 0) {
      status = 'Matchad'
      teacherName = groupById[members[0].group_id] ?? ''
    } else if (proposals.some((p: any) => p.status === 'pending' || p.status === 'approved')) {
      status = 'Under granskning'
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
}
