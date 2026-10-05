-- Clips
create table clips (
  id             uuid primary key default uuid_generate_v4(),
  video_id       uuid not null references videos(id) on delete cascade,
  start_s        numeric not null,
  end_s          numeric not null,
  score          int not null default 0,
  reason         text not null default '',
  source         clip_source not null,
  hook           text,
  caption_style  text,
  status         clip_status not null default 'candidate',
  storage_key    text,
  check (end_s > start_s)
);

create index clips_video_status on clips(video_id, status);

-- Destinations (no tokens here — tokens live in Vault via platform_tokens)
create table destinations (
  id            uuid primary key default uuid_generate_v4(),
  show_id       uuid not null references shows(id) on delete cascade,
  platform      platform_type not null,
  default_mode  publish_mode not null default 'automatic',
  account_ref   text not null,
  unique (show_id, platform)
);

-- platform_tokens is accessible only via service role — no RLS grants to authenticated users
create table platform_tokens (
  id           uuid primary key default uuid_generate_v4(),
  platform     platform_type not null,
  account_ref  text not null,
  secret_id    text not null,
  unique (platform, account_ref)
);

-- Packages
create table packages (
  id                  uuid primary key default uuid_generate_v4(),
  video_id            uuid references videos(id) on delete cascade,
  clip_id             uuid references clips(id) on delete cascade,
  platform            platform_type not null,
  title               text not null,
  description         text not null default '',
  tags                text[] not null default '{}',
  thumbnail_asset_id  uuid references assets(id) on delete set null,
  publish_at          timestamptz,
  mode                publish_mode not null default 'automatic',
  status              package_status not null default 'draft',
  external_id         text,
  post_url            text,
  attempts            int not null default 0,
  check (video_id is not null or clip_id is not null)
);

create index packages_publish_at on packages(publish_at) where status in ('ready', 'scheduled');

create table platform_approvals (
  platform      platform_type primary key,
  status        text not null default 'not_submitted' check (status in ('not_submitted', 'pending', 'approved', 'rejected')),
  submitted_at  timestamptz,
  feedback      text,
  next_action   text,
  updated_by    uuid references profiles(id)
);

-- Metrics snapshots
create table metrics_snapshots (
  id           uuid primary key default uuid_generate_v4(),
  package_id   uuid not null references packages(id) on delete cascade,
  platform     platform_type not null,
  captured_at  timestamptz not null default now(),
  metrics      jsonb not null default '{}'
);

create index metrics_snapshots_package on metrics_snapshots(package_id, captured_at desc);
