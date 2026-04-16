import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej autentiserad.' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Ej behörig.' }, { status: 403 })

  const wb = XLSX.utils.book_new()

  // Barn
  const wsBarn = XLSX.utils.aoa_to_sheet([
    ['Barnets namn', 'Födelsedatum (ÅÅÅÅ-MM-DD)', 'Ämne', 'Diagnos', 'Övrig info', 'Förälderns namn', 'Förälderns e-post'],
    ['Anna Svensson', '2014-03-15', 'svenska', 'dyslexi', '', 'Sara Svensson', 'sara@email.se'],
    ['Erik Holm', '2013-07-22', 'matte', '', '', 'Klas Holm', 'klas@email.se'],
  ])
  wsBarn['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, wsBarn, 'Barn')

  // Lärare
  const wsLarare = XLSX.utils.aoa_to_sheet([
    ['Namn', 'E-post', 'Telefon', 'Kan undervisa i', 'Åldersgrupper', 'Max grupper'],
    ['Hanna Lärare', 'hanna@email.se', '070-1234567', 'svenska, matte', 'F-9, 10-12', 2],
    ['Erik Pedagog', 'erik@email.se', '', 'engelska', '13-15', 1],
  ])
  wsLarare['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsLarare, 'Lärare')

  // Grupper
  const wsGrupper = XLSX.utils.aoa_to_sheet([
    ['Grupp-ID', 'Lärarens e-post', 'Barnets namn', 'Status'],
    [1, 'hanna@email.se', 'Anna Svensson', 'active'],
    [1, 'hanna@email.se', 'Erik Holm', 'active'],
    [2, 'erik@email.se', 'Lisa Berg', 'forming'],
  ])
  wsGrupper['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsGrupper, 'Grupper')

  // Instruktioner
  const wsInstr = XLSX.utils.aoa_to_sheet([
    ['INSTRUKTIONER'],
    [''],
    ['BARN — giltiga värden:'],
    ['Ämne:', 'svenska  |  matte  |  engelska'],
    ['Diagnos:', 'dyslexi  |  dyskalkyli  |  adhd  |  autism  |  sprakstorning  |  annat  |  (lämna tomt om ingen)'],
    ['Flera diagnoser:', 'separera med komma, t.ex: dyslexi, adhd'],
    [''],
    ['LÄRARE — giltiga värden:'],
    ['Kan undervisa i:', 'svenska  |  matte  |  engelska  (separera med komma vid flera)'],
    ['Åldersgrupper:', 'F-9  |  10-12  |  13-15  (separera med komma vid flera)'],
    ['Max grupper:', 'siffra, t.ex. 1, 2 eller 3'],
    [''],
    ['GRUPPER:'],
    ['Grupp-ID:', 'valfritt nummer (1, 2, 3...) — används bara för att länka rätt barn med rätt lärare i denna fil'],
    ['Status:', 'active  |  forming  |  full'],
    ['Obs:', 'barn utan grupp lämnar du utanför Grupper-fliken — de hamnar automatiskt i kön'],
  ])
  wsInstr['!cols'] = [{ wch: 22 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruktioner')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="edly-importmall.xlsx"',
    },
  })
}
