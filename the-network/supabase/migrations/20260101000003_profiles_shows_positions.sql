-- Profiles: mirrors auth.users, extended with display info
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text not null,
  initials      text not null check (char_length(initials) between 1 and 3),
  avatar_colour text,
  created_at    timestamptz not null default now()
);

-- Trigger: auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 2))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Shows
create table shows (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  slug               text not null unique,
  brand_kit_id       uuid,
  default_edit_type  edit_type not null default 'show',
  default_camera     camera_mode not null default 'multi',
  archived           boolean not null default false
);

-- Positions: org chart with ltree hierarchy
create table positions (
  id         uuid primary key default uuid_generate_v4(),
  parent_id  uuid references positions(id) on delete set null,
  title      text not null,
  role       role_type not null,
  person_id  uuid references profiles(id) on delete set null,
  show_ids   uuid[] not null default '{}',
  path       ltree not null unique
);

create index positions_path_gist on positions using gist(path);
create index positions_person on positions(person_id) where person_id is not null;

-- Permission tables
create table role_permissions (
  role        role_type not null,
  permission  permission_type not null,
  primary key (role, permission)
);

create table position_permissions (
  position_id  uuid not null references positions(id) on delete cascade,
  permission   permission_type not null,
  allowed      boolean not null,
  primary key (position_id, permission)
);

-- Seed default role permissions
insert into role_permissions (role, permission) values
  ('executive', 'approve_cut'),
  ('executive', 'run_ai_jobs'),
  ('executive', 'approve_packaging'),
  ('executive', 'publish'),
  ('executive', 'manage_destinations'),
  ('executive', 'manage_users'),
  ('executive', 'view_metrics'),
  ('head',      'approve_cut'),
  ('head',      'run_ai_jobs'),
  ('head',      'approve_packaging'),
  ('head',      'publish'),
  ('head',      'manage_destinations'),
  ('head',      'view_metrics'),
  ('producer',  'approve_cut'),
  ('producer',  'run_ai_jobs'),
  ('producer',  'approve_packaging'),
  ('producer',  'view_metrics'),
  ('editor',    'run_ai_jobs'),
  ('social',    'publish'),
  ('viewer',    'view_metrics');

-- Helper: check if the calling user has a given permission for a show
create or replace function has_permission(perm permission_type, check_show_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.positions p
    left join public.role_permissions rp on rp.role = p.role and rp.permission = perm
    left join public.position_permissions pp on pp.position_id = p.id and pp.permission = perm
    where p.person_id = auth.uid()
      and (check_show_id is null or check_show_id = any(p.show_ids) or p.show_ids = '{}')
      and (
        (rp.permission is not null and not exists (
          select 1 from public.position_permissions
          where position_id = p.id and permission = perm and not allowed
        ))
        or (pp.position_id is not null and pp.allowed)
      )
  );
$$;

-- Helper: can the calling user see a position by path
-- search_path must include public so PostgreSQL can resolve the ltree @> operator
create or replace function can_see(subject_path ltree)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from positions
    where person_id = auth.uid()
      and (path @> subject_path or path = subject_path)
  );
$$;
