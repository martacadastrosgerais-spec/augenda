-- Migration: Epic 8 — Cartão de Emergência
-- Adiciona campos ao perfil do pet e políticas públicas para o cartão

-- 1. Novos campos em pets
alter table pets
  add column if not exists sex text check (sex in ('male', 'female', 'unknown')),
  add column if not exists microchip text,
  add column if not exists neutered boolean default false,
  add column if not exists allergies text,
  add column if not exists vet_name text,
  add column if not exists vet_phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_card_enabled boolean not null default false;

-- 2. RLS pública: anon lê pets cujo cartão está habilitado
create policy "cartao emergencia pets publico"
  on pets for select
  to anon
  using (emergency_card_enabled = true);

-- 3. RLS pública: anon lê medicamentos ativos de pets com cartão habilitado
create policy "cartao emergencia medicamentos publico"
  on medications for select
  to anon
  using (
    pet_id in (
      select id from pets where emergency_card_enabled = true
    )
    and active = true
  );

-- 4. RLS pública: anon lê vacinas de pets com cartão habilitado
create policy "cartao emergencia vacinas publico"
  on vaccines for select
  to anon
  using (
    pet_id in (
      select id from pets where emergency_card_enabled = true
    )
  );
