-- Row-Level Security policies
-- All tables default DENY; explicit policies grant access.

-- profiles: everyone can read; only the owner can update their own row
alter table profiles enable row level security;
create policy "Profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "Users update own profile"
  on profiles for update to authenticated using (auth.uid() = id);

-- shows: viewable by all authenticated; insert/update by those with manage_users
alter table shows enable row level security;
create policy "Shows readable by authenticated"
  on shows for select to authenticated using (true);
create policy "Shows editable by managers"
  on shows for all to authenticated
  using (has_permission('manage_users'::permission_type))
  with check (has_permission('manage_users'::permission_type));

-- positions: viewable by all; editable by managers
alter table positions enable row level security;
create policy "Positions readable by authenticated"
  on positions for select to authenticated using (true);
create policy "Positions editable by managers"
  on positions for all to authenticated
  using (has_permission('manage_users'::permission_type))
  with check (has_permission('manage_users'::permission_type));

-- videos: visible when assigned or position covers the show
alter table videos enable row level security;
create policy "Videos visible to assigned or show-covering positions"
  on videos for select to authenticated
  using (
    exists (
      select 1 from video_assignments
      where video_id = videos.id and person_id = auth.uid()
    )
    or exists (
      select 1 from positions
      where person_id = auth.uid()
        and (
          videos.show_id is null
          or videos.show_id = any(show_ids)
          or show_ids = '{}'
        )
    )
  );
create policy "Videos insertable by producers+"
  on videos for insert to authenticated
  with check (has_permission('approve_cut'::permission_type));
create policy "Videos updatable by producers+"
  on videos for update to authenticated
  using (has_permission('approve_cut'::permission_type));

-- messages: visible to thread members
alter table messages enable row level security;
create policy "Messages visible to thread members"
  on messages for select to authenticated
  using (
    exists (
      select 1 from thread_members
      where thread_id = messages.thread_id and person_id = auth.uid()
    )
  );
create policy "Messages insertable by thread members"
  on messages for insert to authenticated
  with check (
    exists (
      select 1 from thread_members
      where thread_id = messages.thread_id and person_id = auth.uid()
    )
  );

-- threads: visible to members
alter table threads enable row level security;
create policy "Threads visible to members"
  on threads for select to authenticated
  using (
    exists (
      select 1 from thread_members
      where thread_id = threads.id and person_id = auth.uid()
    )
  );

-- devices: only the owner sees their own devices
alter table devices enable row level security;
create policy "Devices visible to owner"
  on devices for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- jobs: owner device can claim; created_by can view
alter table jobs enable row level security;
create policy "Jobs visible to creator or target device owner"
  on jobs for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from devices
      where id = jobs.target_device_id and owner_id = auth.uid()
    )
  );

-- clips: same visibility as parent video
alter table clips enable row level security;
create policy "Clips visible when parent video is visible"
  on clips for select to authenticated
  using (
    exists (
      select 1 from videos v
      left join video_assignments va on va.video_id = v.id and va.person_id = auth.uid()
      left join positions p on p.person_id = auth.uid()
        and (v.show_id is null or v.show_id = any(p.show_ids) or p.show_ids = '{}')
      where v.id = clips.video_id
        and (va.person_id is not null or p.id is not null)
    )
  );

-- packages: visible by show position holders
alter table packages enable row level security;
create policy "Packages visible by show position holders"
  on packages for select to authenticated
  using (
    exists (
      select 1 from videos v
      join positions p on p.person_id = auth.uid()
        and (v.show_id is null or v.show_id = any(p.show_ids) or p.show_ids = '{}')
      where v.id = packages.video_id
    )
    or (
      packages.clip_id is not null and exists (
        select 1 from clips c
        join videos v on v.id = c.video_id
        join positions p on p.person_id = auth.uid()
          and (v.show_id is null or v.show_id = any(p.show_ids) or p.show_ids = '{}')
        where c.id = packages.clip_id
      )
    )
  );

-- platform_tokens: never accessible to non-service roles
alter table platform_tokens enable row level security;
-- no policies = no access for authenticated/anon roles

-- dashboard_layouts: each user sees only their own
alter table dashboard_layouts enable row level security;
create policy "Dashboard layout for own user"
  on dashboard_layouts for all to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

-- role_layouts: readable by all
alter table role_layouts enable row level security;
create policy "Role layouts readable by authenticated"
  on role_layouts for select to authenticated using (true);

-- approvals: visible to the assigned position holder
alter table approvals enable row level security;
create policy "Approvals visible to assigned position holder"
  on approvals for select to authenticated
  using (
    exists (
      select 1 from positions
      where id = approvals.assigned_position_id and person_id = auth.uid()
    )
    or has_permission('manage_users'::permission_type)
  );

-- Enable RLS on remaining tables (read by authenticated where parent is visible)
alter table season_templates enable row level security;
create policy "Season templates readable by authenticated" on season_templates for select to authenticated using (true);

alter table video_assignments enable row level security;
create policy "Video assignments readable by authenticated" on video_assignments for select to authenticated using (true);

alter table running_order enable row level security;
create policy "Running order readable by authenticated" on running_order for select to authenticated using (true);

alter table guests enable row level security;
create policy "Guests readable by authenticated" on guests for select to authenticated using (true);

alter table kit_checks enable row level security;
create policy "Kit checks readable by authenticated" on kit_checks for select to authenticated using (true);

alter table calendar_events enable row level security;
create policy "Calendar events readable by authenticated" on calendar_events for select to authenticated using (true);

alter table markers enable row level security;
create policy "Markers readable by authenticated" on markers for select to authenticated using (true);

alter table device_files enable row level security;
create policy "Device files readable by device owner" on device_files for select to authenticated
  using (exists (select 1 from devices where id = device_files.device_id and owner_id = auth.uid()));

alter table comments enable row level security;
create policy "Comments readable by authenticated" on comments for select to authenticated using (true);

alter table assets enable row level security;
create policy "Assets readable by authenticated" on assets for select to authenticated using (true);

alter table brand_kits enable row level security;
create policy "Brand kits readable by authenticated" on brand_kits for select to authenticated using (true);

alter table metrics_snapshots enable row level security;
create policy "Metrics readable by view_metrics holders" on metrics_snapshots for select to authenticated
  using (has_permission('view_metrics'::permission_type));

alter table thread_members enable row level security;
create policy "Thread members visible to own user" on thread_members for select to authenticated
  using (person_id = auth.uid());

alter table push_subscriptions enable row level security;
create policy "Push subscriptions for own user" on push_subscriptions for all to authenticated
  using (person_id = auth.uid()) with check (person_id = auth.uid());

alter table audit_log enable row level security;
create policy "Audit log readable by executives" on audit_log for select to authenticated
  using (has_permission('manage_users'::permission_type));

alter table edit_decisions enable row level security;
create policy "Edit decisions readable by authenticated" on edit_decisions for select to authenticated using (true);

alter table risk_flags enable row level security;
create policy "Risk flags readable by authenticated" on risk_flags for select to authenticated using (true);

alter table style_profiles enable row level security;
create policy "Style profiles readable by authenticated" on style_profiles for select to authenticated using (true);

alter table corrections enable row level security;
create policy "Corrections readable by authenticated" on corrections for select to authenticated using (true);

alter table destinations enable row level security;
create policy "Destinations readable by manage_destinations holders" on destinations for select to authenticated
  using (has_permission('manage_destinations'::permission_type));

alter table platform_approvals enable row level security;
create policy "Platform approvals readable by manage_destinations holders" on platform_approvals for select to authenticated
  using (has_permission('manage_destinations'::permission_type));
