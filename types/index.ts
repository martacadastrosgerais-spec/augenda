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

export interface Attachment {
  id: string;
  procedure_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  size_bytes?: number;
  created_at: string;
}
