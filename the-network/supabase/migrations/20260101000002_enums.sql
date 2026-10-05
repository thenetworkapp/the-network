-- Enumerations used across the schema

create type role_type as enum (
  'executive', 'head', 'producer', 'editor', 'designer', 'host', 'social', 'viewer'
);

create type permission_type as enum (
  'approve_cut', 'run_ai_jobs', 'approve_packaging', 'publish',
  'manage_destinations', 'manage_users', 'view_metrics'
);

create type video_stage as enum (
  'idea', 'scheduled', 'pre_production', 'recording', 'footage_received',
  'ai_editing', 'review', 'approved', 'packaging', 'upload_ready', 'published', 'archived'
);

create type edit_type as enum ('show', 'podcast', 'quick');
create type camera_mode as enum ('multi', 'single', 'remote');

create type file_kind as enum ('raw', 'project', 'export', 'proxy');

create type job_kind as enum ('proxy', 'ai_edit', 'render', 'clips', 'review_copy', 'backup');
create type job_status as enum ('queued', 'running', 'done', 'failed', 'cancelled');

create type decision_status as enum ('pending', 'approved', 'rejected', 'applied');

create type asset_kind as enum ('template', 'image', 'sting', 'music', 'thumbnail', 'channel');

create type clip_source as enum ('ai', 'marker', 'planned', 'manual');
create type clip_status as enum ('candidate', 'approved', 'rejected', 'rendering', 'ready', 'posted');

create type platform_type as enum (
  'youtube', 'instagram', 'tiktok', 'spotify', 'apple_podcasts', 'rss'
);
create type publish_mode as enum ('automatic', 'manual');
create type package_status as enum (
  'draft', 'ready', 'scheduled', 'uploading', 'published', 'failed'
);

create type notify_level as enum ('all', 'mentions', 'none');

create type event_kind as enum ('record', 'publish', 'review', 'meeting', 'deadline');
