-- Migration: Epic 6 — Diário clínico / log de sintomas

create table symptom_logs (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  noted_at timestamp with time zone not null default now(),
  description text not null,
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high')),
  related_event_type text check (related_event_type in ('vaccine', 'medication', 'procedure')),
  related_event_id uuid,
  created_at timestamp with time zone default now()
);

alter table symptom_logs enable row level security;

create policy "usuarios gerenciam diario dos seus pets"
  on symptom_logs for all
  using (
    pet_id in (
      select id from pets where user_id = auth.uid()
      union
      select pet_id from pet_members where user_id = auth.uid()
    )
  );
