-- Recurring products (ração, higiene, medicamentos recorrentes)
create table if not exists recurring_products (
  id uuid default gen_random_uuid() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  name text not null,
  category text check (category in ('food', 'hygiene', 'medication', 'other')) not null default 'other',
  cycle_days integer not null,
  last_purchased_at date,
  notes text,
  created_at timestamptz default now()
);

alter table recurring_products enable row level security;

create policy "Users can manage recurring products for their pets"
  on recurring_products for all
  using (
    exists (
      select 1 from pets where pets.id = recurring_products.pet_id and pets.user_id = auth.uid()
    )
  );
