-- Devices (editing machines)
create table devices (
  id               uuid primary key default uuid_generate_v4(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  name             text not null,
  has_footage_root boolean not null default false,
  last_seen_at     timestamptz
);

create index devices_owner on devices(owner_id);

create table device_files (
  device_id  uuid not null references devices(id) on delete cascade,
  video_id   uuid not null references videos(id) on delete cascade,
  kind       file_kind not null,
  rel_path   text not null,
  bytes      bigint not null default 0,
  sha256     text,
  seen_at    timestamptz not null default now(),
  primary key (device_id, video_id, kind, rel_path)
);

-- Processing jobs
create table jobs (
  id               uuid primary key default uuid_generate_v4(),
  kind             job_kind not null,
  video_id         uuid not null references videos(id) on delete cascade,
  target_device_id uuid not null references devices(id),
  status           job_status not null default 'queued',
  progress         numeric not null default 0 check (progress between 0 and 100),
  payload          jsonb not null default '{}',
  result           jsonb,
  error            text,
  created_by       uuid not null references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index jobs_video on jobs(video_id);
create index jobs_device_status on jobs(target_device_id, status);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function touch_updated_at();

create table edit_decisions (
  id        uuid primary key default uuid_generate_v4(),
  video_id  uuid not null references videos(id) on delete cascade,
  kind      text not null check (kind in ('cut', 'reorder', 'cold_open')),
  start_s   numeric not null,
  end_s     numeric not null,
  reason    text not null default '',
  status    decision_status not null default 'pending',
  check (end_s > start_s)
);

create table risk_flags (
  id        uuid primary key default uuid_generate_v4(),
  video_id  uuid not null references videos(id) on delete cascade,
  kind      text not null check (kind in ('legal', 'copyright', 'language', 'sensitive')),
  start_s   numeric not null,
  end_s     numeric not null,
  note      text not null default '',
  status    text not null default 'open' check (status in ('open', 'acknowledged', 'resolved'))
);

create table style_profiles (
  show_id     uuid not null references shows(id) on delete cascade,
  edit_type   edit_type not null,
  profile     jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (show_id, edit_type)
);

create table corrections (
  id          uuid primary key default uuid_generate_v4(),
  video_id    uuid not null references videos(id) on delete cascade,
  kind        text not null,
  before      jsonb not null,
  after       jsonb not null,
  author_id   uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
