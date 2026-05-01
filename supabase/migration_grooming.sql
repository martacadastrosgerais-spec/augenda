-- Grooming logs table (banho e tosa)
create table if not exists grooming_logs (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  type text check (type in ('bath', 'grooming', 'both')) not null default 'bath',
  performed_at timestamptz not null,
  groomer_name text,
  notes text,
  next_at date,
  created_at timestamptz default now()
);

alter table grooming_logs enable row level security;

create policy "Users can manage grooming logs for their pets"
  on grooming_logs for all
  using (
    exists (
      select 1 from pets
      where pets.id = grooming_logs.pet_id
        and pets.user_id = auth.uid()
    )
  );
