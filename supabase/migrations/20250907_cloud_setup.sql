-- Create public thumbnails bucket if not exists
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Jobs table and trigger
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  frames jsonb not null,
  layout_image text,
  variants int not null default 4,
  status text not null default 'queued',
  result_urls text[] default '{}',
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

