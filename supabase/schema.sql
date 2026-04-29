-- AUgenda - Schema do Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase

-- Extensão UUID
create extension if not exists "uuid-ossp";

-- Tabela de pets
create table pets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  species text not null check (species in ('dog', 'cat')),
  breed text,
  birth_date date,
  photo_url text,
  weight_kg numeric(5,2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabela de vacinas
create table vaccines (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  name text not null,
  applied_at date not null,
  next_dose_at date,
  vet_name text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Tabela de medicamentos
create table medications (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  name text not null,
  dose text,
  frequency text,
  started_at date not null,
  ends_at date,
  notes text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Tabela de procedimentos
create table procedures (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  type text not null check (type in ('consultation', 'surgery', 'exam', 'other')),
  title text not null,
  performed_at date not null,
  vet_name text,
  description text,
  created_at timestamp with time zone default now()
);

-- Tabela de anexos
create table attachments (
  id uuid default uuid_generate_v4() primary key,
  procedure_id uuid references procedures(id) on delete cascade not null,
  name text not null,
  file_url text not null,
  file_type text,
  size_bytes bigint,
  created_at timestamp with time zone default now()
);

-- Ativar Row Level Security
alter table pets enable row level security;
alter table vaccines enable row level security;
alter table medications enable row level security;
alter table procedures enable row level security;
alter table attachments enable row level security;

-- Políticas RLS: cada usuário vê e gerencia apenas seus dados
create policy "usuarios gerenciam seus pets" on pets
  for all using (auth.uid() = user_id);

create policy "usuarios gerenciam vacinas dos seus pets" on vaccines
  for all using (
    exists (select 1 from pets where pets.id = vaccines.pet_id and pets.user_id = auth.uid())
  );

create policy "usuarios gerenciam medicamentos dos seus pets" on medications
  for all using (
    exists (select 1 from pets where pets.id = medications.pet_id and pets.user_id = auth.uid())
  );

create policy "usuarios gerenciam procedimentos dos seus pets" on procedures
  for all using (
    exists (select 1 from pets where pets.id = procedures.pet_id and pets.user_id = auth.uid())
  );

create policy "usuarios gerenciam anexos dos seus procedimentos" on attachments
  for all using (
    exists (
      select 1 from procedures
      join pets on pets.id = procedures.pet_id
      where procedures.id = attachments.procedure_id
        and pets.user_id = auth.uid()
    )
  );

-- Storage bucket para arquivos
insert into storage.buckets (id, name, public) values ('pet-files', 'pet-files', false);

create policy "usuarios fazem upload nos seus arquivos" on storage.objects
  for insert with check (auth.uid()::text = (storage.foldername(name))[1]);

create policy "usuarios acessam seus arquivos" on storage.objects
  for select using (auth.uid()::text = (storage.foldername(name))[1]);

create policy "usuarios deletam seus arquivos" on storage.objects
  for delete using (auth.uid()::text = (storage.foldername(name))[1]);
