-- Migration: Epic 3 — Lembretes com recorrência

create table reminders (
  id uuid default uuid_generate_v4() primary key,
  pet_id uuid references pets(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  type text not null default 'custom'
    check (type in ('vaccine', 'medication', 'procedure', 'custom')),
  scheduled_date date not null,
  time_of_day time not null default '09:00:00',
  recurrence text not null default 'once'
    check (recurrence in ('once', 'daily', 'weekly', 'monthly', 'yearly')),
  enabled boolean not null default true,
  local_notification_id text,
  notes text,
  created_at timestamp with time zone default now()
);

alter table reminders enable row level security;

create policy "usuarios gerenciam seus lembretes"
  on reminders for all
  using (auth.uid() = user_id);
