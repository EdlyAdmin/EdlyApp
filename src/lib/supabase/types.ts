export type UserRole = 'family' | 'teacher' | 'admin'
export type TeacherStatus = 'pending' | 'approved' | 'rejected'
export type Subject = 'svenska' | 'matte' | 'engelska'
export type DiagnosisItem = 'dyslexi' | 'dyskalkyli' | 'adhd' | 'autism' | 'sprakstorning' | 'annat'
/** @deprecated Använd diagnoses (array) istället */
export type Diagnosis = 'dyslexi' | 'dyskalkyli' | 'båda' | 'ingen'
export type GroupStatus = 'active' | 'closed'
export type ProposalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  role: UserRole
  created_at: string
}

export interface Family {
  id: string
  profile_id: string
  parent_name: string
  email: string
  created_at: string
}

export interface Child {
  id: string
  family_id: string
  name: string
  age: number
  subjects: Subject[]
  diagnoses: string[]
  diagnosis_other?: string
  extra_info?: string
  created_at: string
}

export interface Teacher {
  id: string
  profile_id: string
  name: string
  email: string
  phone?: string
  subjects_can: Subject[]
  subjects_blocked: Subject[]
  max_groups: number
  status: TeacherStatus
  notify_new_children: boolean
  motivation?: string
  created_at: string
}

export interface Group {
  id: string
  teacher_id: string
  status: GroupStatus
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  child_id: string
  created_at: string
}

export interface MatchProposal {
  id: string
  child_id: string
  teacher_id: string
  status: ProposalStatus
  created_at: string
}

// Anonymiserad vy för uppdragsbanken
export interface AssignmentBankEntry {
  id: string
  age: number
  subjects: Subject[]
  diagnoses: string[]
  diagnosis_other?: string
  extra_info?: string
  created_at: string
}

export interface MailErrorLog {
  id: string
  type: 'intro' | 'teacher_notify' | 'welcome' | 'rejected' | 'new_child'
  recipient: string
  error: string
  created_at: string
  resolved: boolean
}
