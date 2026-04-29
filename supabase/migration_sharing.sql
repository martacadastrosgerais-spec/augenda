-- AUgenda — Migração: Compartilhamento de pets entre tutores
-- Execute no SQL Editor do Supabase APÓS o schema.sql inicial

-- ─────────────────────────────────────────
-- 1. Profiles (espelho público de auth.users)
-- ─────────────────────────────────────────
create table if not exists profiles (
  id   uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

-- Qualquer usuário autenticado pode ver perfis (para exibir email dos membros)
create policy "perfis sao visiveis" on profiles
  for select using (auth.uid() is not null);

create policy "usuario gerencia proprio perfil" on profiles
  for all using (auth.uid() = id);

-- Trigger: cria perfil automaticamente a cada novo usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Backfill: cria perfis para usuários já existentes
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ─────────────────────────────────────────
-- 2. Membros do pet
-- ─────────────────────────────────────────
create table if not exists pet_members (
  id          uuid default uuid_generate_v4() primary key,
  pet_id      uuid references pets(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  role        text not null check (role in ('owner', 'editor', 'viewer')) default 'viewer',
  invited_by  uuid references auth.users(id),
  created_at  timestamp with time zone default now(),
  unique(pet_id, user_id)
);

alter table pet_members enable row level security;

-- Dono e membros veem a lista de membros do pet
create policy "membros veem lista" on pet_members
  for select using (
    exists (
      select 1 from pets
      where pets.id = pet_members.pet_id
        and (
          pets.user_id = auth.uid()
          or exists (
            select 1 from pet_members pm2
            where pm2.pet_id = pet_members.pet_id and pm2.user_id = auth.uid()
          )
        )
    )
  );

-- Usuário pode adicionar a si mesmo (ao aceitar convite) ou dono adiciona outros
create policy "inserir membro" on pet_members
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from pets where pets.id = pet_members.pet_id and pets.user_id = auth.uid())
  );

-- Dono pode remover qualquer membro; membro pode sair
create policy "remover membro" on pet_members
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from pets where pets.id = pet_members.pet_id and pets.user_id = auth.uid())
  );

-- ─────────────────────────────────────────
-- 3. Códigos de convite
-- ─────────────────────────────────────────
create table if not exists pet_invites (
  id          uuid default uuid_generate_v4() primary key,
  pet_id      uuid references pets(id) on delete cascade not null,
  code        text not null unique,
  created_by  uuid references auth.users(id) not null,
  expires_at  timestamp with time zone not null default (now() + interval '48 hours'),
  used_by     uuid references auth.users(id),
  used_at     timestamp with time zone,
  created_at  timestamp with time zone default now()
);

alter table pet_invites enable row level security;

-- Qualquer autenticado pode ler convite pelo código (para validar)
create policy "convites legíveis" on pet_invites
  for select using (auth.uid() is not null);

-- Dono cria convites para seus pets
create policy "dono cria convite" on pet_invites
  for insert with check (
    exists (select 1 from pets where pets.id = pet_invites.pet_id and pets.user_id = auth.uid())
  );

-- Usuário autenticado pode marcar convite como usado
create policy "usuario usa convite" on pet_invites
  for update using (auth.uid() is not null);

-- Dono pode deletar convites de seus pets
create policy "dono deleta convite" on pet_invites
  for delete using (auth.uid() = created_by);

-- ─────────────────────────────────────────
-- 4. Atualizar RLS de pets para incluir membros
-- ─────────────────────────────────────────
drop policy if exists "usuarios gerenciam seus pets" on pets;

-- Dono tem acesso total
create policy "dono gerencia pet" on pets
  for all using (auth.uid() = user_id);

-- Membros têm acesso de leitura
create policy "membros visualizam pet" on pets
  for select using (
    exists (
      select 1 from pet_members
      where pet_members.pet_id = pets.id
        and pet_members.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- 5. Atualizar RLS de vacinas, medicamentos e procedimentos
-- ─────────────────────────────────────────
drop policy if exists "usuarios gerenciam vacinas dos seus pets" on vaccines;
create policy "acesso a vacinas" on vaccines
  for all using (
    exists (
      select 1 from pets
      where pets.id = vaccines.pet_id
        and (
          pets.user_id = auth.uid()
          or exists (
            select 1 from pet_members
            where pet_members.pet_id = pets.id and pet_members.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "usuarios gerenciam medicamentos dos seus pets" on medications;
create policy "acesso a medicamentos" on medications
  for all using (
    exists (
      select 1 from pets
      where pets.id = medications.pet_id
        and (
          pets.user_id = auth.uid()
          or exists (
            select 1 from pet_members
            where pet_members.pet_id = pets.id and pet_members.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "usuarios gerenciam procedimentos dos seus pets" on procedures;
create policy "acesso a procedimentos" on procedures
  for all using (
    exists (
      select 1 from pets
      where pets.id = procedures.pet_id
        and (
          pets.user_id = auth.uid()
          or exists (
            select 1 from pet_members
            where pet_members.pet_id = pets.id and pet_members.user_id = auth.uid()
          )
        )
    )
  );
