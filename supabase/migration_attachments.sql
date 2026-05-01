-- Attachments table for procedure documents
create table if not exists attachments (
  id uuid default gen_random_uuid() primary key,
  procedure_id uuid references procedures(id) on delete cascade not null,
  name text not null,
  file_url text not null,
  file_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);

alter table attachments enable row level security;

create policy "Users can manage their procedure attachments"
  on attachments for all
  using (
    exists (
      select 1 from procedures p
      join pets on pets.id = p.pet_id
      where p.id = attachments.procedure_id
        and pets.user_id = auth.uid()
    )
  );

-- Storage bucket for procedure documents
insert into storage.buckets (id, name, public)
values ('pet-docs', 'pet-docs', true)
on conflict (id) do nothing;

create policy "Authenticated upload to pet-docs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pet-docs');

create policy "Public read pet-docs"
  on storage.objects for select
  using (bucket_id = 'pet-docs');

create policy "Authenticated delete pet-docs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pet-docs');
