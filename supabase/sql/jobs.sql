-- Jobs table for async thumbnail generation
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  frames jsonb not null,
  layout_image text,
  variants int not null default 4,
  status text not null default 'queued', -- queued | processing | done | error
  result_urls text[] default '{}',
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional: update updated_at automatically
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at
before update on jobs
for each row
execute function set_updated_at();

