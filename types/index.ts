export type Species = "dog" | "cat";

export type MemberRole = "owner" | "editor" | "viewer";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface PetMember {
  id: string;
  pet_id: string;
  user_id: string;
  role: MemberRole;
  invited_by?: string;
  created_at: string;
  profiles?: Profile;
}

export interface PetInvite {
  id: string;
  pet_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  used_by?: string;
  used_at?: string;
  created_at: string;
}

export interface PetWithMeta extends Pet {
  isOwner: boolean;
  memberCount: number;
}

export type ProcedureType = "consultation" | "surgery" | "exam" | "other";

export type PetSex = "male" | "female" | "unknown";

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed?: string;
  birth_date?: string;
  photo_url?: string;
  weight_kg?: number;
  sex?: PetSex;
  microchip?: string;
  neutered?: boolean;
  allergies?: string;
  vet_name?: string;
  vet_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_card_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vaccine {
  id: string;
  pet_id: string;
  name: string;
  applied_at: string;
  next_dose_at?: string;
  vet_name?: string;
  notes?: string;
  created_at: string;
}

export interface Medication {
  id: string;
  pet_id: string;
  name: string;
  dose?: string;
  frequency?: string;
  started_at: string;
  ends_at?: string;
  notes?: string;
  active: boolean;
  restock_reminder_days?: number | null;
  created_at: string;
}

export interface Procedure {
  id: string;
  pet_id: string;
  type: ProcedureType;
  title: string;
  performed_at: string;
  vet_name?: string;
  description?: string;
  created_at: string;
  attachments?: Attachment[];
}

export type ReminderType = "vaccine" | "medication" | "procedure" | "custom";
export type ReminderRecurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";

export interface Reminder {
  id: string;
  pet_id: string;
  user_id: string;
  title: string;
  type: ReminderType;
  scheduled_date: string;
  time_of_day: string;
  recurrence: ReminderRecurrence;
  enabled: boolean;
  local_notification_id?: string;
  notes?: string;
  created_at: string;
}

export interface ChronicCondition {
  id: string;
  pet_id: string;
  name: string;
  diagnosed_at?: string;
  notes?: string;
  created_at: string;
}

export type SymptomSeverity = "low" | "medium" | "high";

export interface SymptomLog {
  id: string;
  pet_id: string;
  noted_at: string;
  description: string;
  severity: SymptomSeverity;
  related_event_type?: "vaccine" | "medication" | "procedure";
  related_event_id?: string;
  created_at: string;
}

export interface MedicationDose {
  id: string;
  medication_id: string;
  pet_id: string;
  administered_at: string;
  administered_by?: string;
  notes?: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  procedure_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  size_bytes?: number;
  created_at: string;
}
