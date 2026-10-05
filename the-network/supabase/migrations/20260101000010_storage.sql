-- Supabase Storage bucket for graphic design assets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  52428800, -- 50 MB per file
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
    'video/mp4', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/aac',
    'application/zip', 'application/pdf'
  ]
);

-- RLS: team members can read assets for shows they can see
create policy "team can read assets"
  on storage.objects for select
  using (
    bucket_id = 'assets'
    and auth.uid() in (select id from profiles)
  );

-- RLS: only users with manage_users or approve_cut permission can upload
create policy "designers and above can upload assets"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and (
      has_permission('approve_cut')
      or has_permission('manage_users')
    )
  );

-- RLS: uploader or admin can delete
create policy "uploader or admin can delete assets"
  on storage.objects for delete
  using (
    bucket_id = 'assets'
    and (
      owner = auth.uid()
      or has_permission('manage_users')
    )
  );
