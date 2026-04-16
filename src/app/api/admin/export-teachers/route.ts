import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska',
  matte: 'Matematik',
  engelska: 'Engelska',
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

    const { data: teachers, error } = await service
      .from('teachers')
      .select('id, name, email, phone, subjects_can, subjects_blocked, age_groups, max_groups, motivation, status, created_at')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Räkna grupper per lärare
    const { data: groups } = await service
      .from('groups')
      .select('teacher_id, status')
      .in('status', ['forming', 'full', 'active'])

    const activeCount: Record<string, number> = {}
    const formingCount: Record<string, number> = {}
    for (const g of groups ?? []) {
      if (g.status === 'active') activeCount[g.teacher_id] = (activeCount[g.teacher_id] ?? 0) + 1
      else formingCount[g.teacher_id] = (formingCount[g.teacher_id] ?? 0) + 1
    }

    const statusLabel = (t: any) => {
      if (t.status === 'pending') return 'Väntar på granskning'
      if (t.status === 'rejected') return 'Nekad'
      if ((activeCount[t.id] ?? 0) > 0) return 'Aktiv'
      if ((formingCount[t.id] ?? 0) > 0) return 'Tilldelad grupp'
      return 'Ingen grupp'
    }

    const rows = (teachers ?? []).map((t: any) => ({
      'Namn': t.name,
      'E-post': t.email,
      'Telefon': t.phone ?? '',
      'Kan undervisa i': (t.subjects_can ?? []).map((s: string) => SUBJECT_LABELS[s] ?? s).join(', '),
      'Ej undervisa i': (t.subjects_blocked ?? []).map((s: string) => SUBJECT_LABELS[s] ?? s).join(', '),
      'Åldersgrupper': (t.age_groups ?? []).join(', '),
      'Max grupper': t.max_groups,
      'Aktiva grupper': activeCount[t.id] ?? 0,
      'Grupper under uppbyggnad': formingCount[t.id] ?? 0,
      'Status': statusLabel(t),
      'Motivation': t.motivation ?? '',
      'Registrerad': new Date(t.created_at).toLocaleDateString('sv-SE'),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 24 },
      { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 },
      { wch: 22 }, { wch: 20 }, { wch: 40 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Lärare')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="edly-larare-${today}.xlsx"`,
      },
    })
  } catch (err: any) {
    console.error('export-teachers error:', err)
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
