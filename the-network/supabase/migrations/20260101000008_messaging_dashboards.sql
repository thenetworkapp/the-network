-- Threads
create table threads (
  id           uuid primary key default uuid_generate_v4(),
  thread_type  text not null check (thread_type in ('general', 'video', 'clip')),
  title        text not null,
  show_id      uuid references shows(id) on delete cascade,
  ref_id       uuid,
  created_at   timestamptz not null default now()
);

create index threads_show on threads(show_id) where show_id is not null;
create index threads_created on threads(created_at desc);

create table thread_members (
  thread_id    uuid not null references threads(id) on delete cascade,
  person_id    uuid not null references profiles(id) on delete cascade,
  notify       notify_level not null default 'all',
  last_read_at timestamptz,
  primary key (thread_id, person_id)
);

create table messages (
  id          uuid primary key default uuid_generate_v4(),
  thread_id   uuid not null references threads(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  body        text not null,
  attachments jsonb,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index messages_thread_created on messages(thread_id, created_at desc);

create table push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  platform    text not null check (platform in ('web', 'ios', 'android'))
);

-- Dashboard layouts
create table dashboard_layouts (
  person_id  uuid primary key references profiles(id) on delete cascade,
  layout     jsonb not null default '[]'
);

create table role_layouts (
  role    role_type primary key,
  layout  jsonb not null default '[]'
);

-- Seed default role layouts
insert into role_layouts (role, layout) values
  ('executive', '[{"widget":"activity_feed","size":"Wide"},{"widget":"approval_queue","size":"M"},{"widget":"platform_health","size":"M"},{"widget":"metrics_overview","size":"L"}]'),
  ('producer',  '[{"widget":"upcoming_records","size":"Wide"},{"widget":"approval_queue","size":"M"},{"widget":"team_availability","size":"M"},{"widget":"active_jobs","size":"L"}]'),
  ('editor',    '[{"widget":"active_jobs","size":"Wide"},{"widget":"footage_status","size":"M"},{"widget":"upcoming_records","size":"M"}]'),
  ('host',      '[{"widget":"my_videos","size":"Wide"},{"widget":"upcoming_records","size":"M"},{"widget":"messages_preview","size":"M"}]');

-- Audit log
create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  actor_id      uuid references profiles(id) on delete set null,
  action        text not null,
  subject_type  text not null,
  subject_id    uuid,
  data          jsonb not null default '{}',
  at            timestamptz not null default now()
);

create index audit_log_at on audit_log(at desc);
create index audit_log_subject on audit_log(subject_type, subject_id);
