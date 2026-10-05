-- Review & approvals
create table comments (
  id          uuid primary key default uuid_generate_v4(),
  video_id    uuid not null references videos(id) on delete cascade,
  timecode_s  numeric,
  body        text not null,
  author_id   uuid not null references profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index comments_video on comments(video_id);

create table approvals (
  id                   uuid primary key default uuid_generate_v4(),
  subject_type         text not null,
  subject_id           uuid not null,
  required_permission  permission_type not null,
  assigned_position_id uuid not null references positions(id),
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'escalated')),
  escalates_at         timestamptz,
  decided_by           uuid references profiles(id),
  decided_at           timestamptz
);

create index approvals_subject on approvals(subject_type, subject_id);
create index approvals_position_status on approvals(assigned_position_id, status);

-- Brand kits & assets
create table brand_kits (
  id            uuid primary key default uuid_generate_v4(),
  show_id       uuid not null unique references shows(id) on delete cascade,
  colours       jsonb not null default '{}',
  fonts         jsonb not null default '{}',
  logo_asset_id uuid
);

create table assets (
  id          uuid primary key default uuid_generate_v4(),
  show_id     uuid references shows(id) on delete cascade,
  kind        asset_kind not null,
  name        text not null,
  template    jsonb,
  storage_key text not null,
  version     int not null default 1,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

alter table brand_kits
  add constraint fk_logo foreign key (logo_asset_id) references assets(id) on delete set null;

alter table shows
  add constraint fk_brand_kit foreign key (brand_kit_id) references brand_kits(id) on delete set null;
