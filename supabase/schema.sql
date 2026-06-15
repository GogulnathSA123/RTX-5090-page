create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null,
  member_email text not null,
  booking_date date not null,
  start_minutes integer not null,
  end_minutes integer not null,
  title text not null,
  created_at timestamptz not null default now(),
  constraint bookings_time_valid check (
    start_minutes >= 480
    and end_minutes <= 1320
    and start_minutes < end_minutes
  )
);

alter table public.bookings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        booking_date with =,
        int4range(start_minutes, end_minutes, '[)') with &&
      );
  end if;
end $$;

drop policy if exists "Bookings are readable by authenticated users" on public.bookings;
drop policy if exists "Users can create their own bookings" on public.bookings;
drop policy if exists "Users can delete their own bookings" on public.bookings;

create policy "Bookings are readable by authenticated users"
  on public.bookings
  for select
  to authenticated
  using (true);

create policy "Users can create their own bookings"
  on public.bookings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own bookings"
  on public.bookings
  for delete
  to authenticated
  using (auth.uid() = user_id);
