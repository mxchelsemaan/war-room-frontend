create table if not exists public.analytics (
  id uuid default gen_random_uuid() primary key,
  event_name text not null,
  metadata jsonb default '{}',
  session_id text,
  created_at timestamptz default now()
);

alter table public.analytics enable row level security;

-- Allow anonymous inserts only (write-only from frontend)
create policy "anon_insert" on public.analytics
  for insert to anon with check (true);

-- Create index for querying by event name and time
create index idx_analytics_event_name on public.analytics (event_name, created_at desc);
