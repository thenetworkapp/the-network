-- Season templates
create table season_templates (
  id            uuid primary key default uuid_generate_v4(),
  show_id       uuid not null references shows(id) on delete cascade,
  record_rule   text not null,
  publish_rule  text not null,
  start_date    date not null,
  end_date      date not null,
  skip_dates    date[] not null default '{}',
  default_team  jsonb not null default '{}'
);

-- Videos
create table videos (
  id                uuid primary key default uuid_generate_v4(),
  show_id           uuid references shows(id) on delete set null,
  episode_no        int,
  title             text not null,
  stage             video_stage not null default 'idea',
  record_at         timestamptz,
  publish_at        timestamptz,
  edit_type         edit_type not null default 'show',
  camera_mode       camera_mode not null default 'multi',
  target_length_s   int,
  owner_position_id uuid references positions(id) on delete set null,
  folder_slug       text,
  created_by        uuid not null references profiles(id),
  created_at        timestamptz not null default now()
);

create index videos_show on videos(show_id);
create index videos_stage on videos(stage);
create index videos_record_at on videos(record_at) where record_at is not null;
create index videos_publish_at on videos(publish_at) where publish_at is not null;

create table video_assignments (
  video_id   uuid not null references videos(id) on delete cascade,
  person_id  uuid not null references profiles(id) on delete cascade,
  role       text not null,
  primary key (video_id, person_id)
);

create table running_order (
  id               uuid primary key default uuid_generate_v4(),
  video_id         uuid not null references videos(id) on delete cascade,
  position         int not null,
  name             text not null,
  target_s         int,
  notes            text,
  planned_clip     boolean not null default false,
  thumbnail_moment boolean not null default false,
  unique (video_id, position)
);

create table guests (
  id            uuid primary key default uuid_generate_v4(),
  video_id      uuid not null references videos(id) on delete cascade,
  name          text not null,
  role          text not null,
  contact       text,
  brief_sent_at timestamptz,
  call_time     timestamptz,
  tech_check_at timestamptz
);

create table kit_checks (
  video_id  uuid not null references videos(id) on delete cascade,
  item      text not null,
  done      boolean not null default false,
  primary key (video_id, item)
);

create table calendar_events (
  id            uuid primary key default uuid_generate_v4(),
  kind          event_kind not null,
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  video_id      uuid references videos(id) on delete set null,
  attendee_ids  uuid[] not null default '{}',
  check (ends_at > starts_at)
);

create index calendar_events_range on calendar_events(starts_at, ends_at);

create table markers (
  id          uuid primary key default uuid_generate_v4(),
  video_id    uuid not null references videos(id) on delete cascade,
  timecode_s  numeric not null,
  note        text not null default '',
  author_id   uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
