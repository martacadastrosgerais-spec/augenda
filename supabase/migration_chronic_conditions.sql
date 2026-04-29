-- Migration: Epic 10 — Condições crônicas

create table chronic_conditions (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  name text not null,
  diagnosed_at date,
  notes text,
  created_at timestamp with time zone default now()
);

alter table chronic_conditions enable row level security;

-- Dono e membros gerenciam
create policy "usuarios gerenciam condicoes dos seus pets"
  on chronic_conditions for all
  using (
    pet_id in (
      select id from pets where user_id = auth.uid()
      union
      select pet_id from pet_members where user_id = auth.uid()
    )
  );

-- Anon lê para o cartão de emergência
create policy "cartao emergencia condicoes publico"
  on chronic_conditions for select
  to anon
  using (
    pet_id in (select id from pets where emergency_card_enabled = true)
  );
