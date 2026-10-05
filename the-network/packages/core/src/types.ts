// Enums
export type RoleType = 'executive' | 'head' | 'producer' | 'editor' | 'designer' | 'host' | 'social' | 'viewer'
export type Permission = 'approve_cut' | 'run_ai_jobs' | 'approve_packaging' | 'publish' | 'manage_destinations' | 'manage_users' | 'view_metrics'

export type VideoStage =
  | 'idea'
  | 'scheduled'
  | 'pre_production'
  | 'recording'
  | 'footage_received'
  | 'ai_editing'
  | 'review'
  | 'approved'
  | 'packaging'
  | 'upload_ready'
  | 'published'
  | 'archived'

export type EditType = 'show' | 'podcast' | 'quick'
export type CameraMode = 'multi' | 'single' | 'remote'
export type FileKind = 'raw' | 'project' | 'export' | 'proxy'
export type JobKind = 'proxy' | 'ai_edit' | 'render' | 'clips' | 'review_copy' | 'backup'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'applied'
export type AssetKind = 'template' | 'image' | 'sting' | 'music' | 'thumbnail' | 'channel'
export type ClipSource = 'ai' | 'marker' | 'planned' | 'manual'
export type ClipStatus = 'candidate' | 'approved' | 'rejected' | 'rendering' | 'ready' | 'posted'
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'spotify' | 'apple_podcasts' | 'rss'
export type PublishMode = 'automatic' | 'manual'
export type PackageStatus = 'draft' | 'ready' | 'scheduled' | 'uploading' | 'published' | 'failed'
export type ThreadKind = 'video' | 'channel' | 'direct'
export type NotifyLevel = 'all' | 'mentions' | 'none'
export type EventKind = 'record' | 'publish' | 'review' | 'meeting' | 'deadline'

// Row types
export interface Profile {
  id: string
  full_name: string
  initials: string
  avatar_colour: string | null
  created_at: string
}

export interface Show {
  id: string
  name: string
  slug: string
  brand_kit_id: string | null
  default_edit_type: EditType
  default_camera: CameraMode
  archived: boolean
}

export interface Position {
  id: string
  parent_id: string | null
  title: string
  role: RoleType
  person_id: string | null
  show_ids: string[]
  path: string
}

export interface RolePermission {
  role: RoleType
  permission: Permission
}

export interface PositionPermission {
  position_id: string
  permission: Permission
  allowed: boolean
}

export interface SeasonTemplate {
  id: string
  show_id: string
  record_rule: string
  publish_rule: string
  start_date: string
  end_date: string
  skip_dates: string[]
  default_team: Record<string, unknown>
}

export interface Video {
  id: string
  show_id: string | null
  episode_no: number | null
  title: string
  stage: VideoStage
  record_at: string | null
  publish_at: string | null
  edit_type: EditType
  camera_mode: CameraMode
  target_length_s: number | null
  owner_position_id: string | null
  folder_slug: string | null
  created_by: string
  created_at: string
}

export interface VideoAssignment {
  video_id: string
  person_id: string
  role: string
}

export interface RunningOrderItem {
  id: string
  video_id: string
  position: number
  name: string
  target_s: number | null
  notes: string | null
  planned_clip: boolean
  thumbnail_moment: boolean
}

export interface Guest {
  id: string
  video_id: string
  name: string
  role: string
  contact: string | null
  brief_sent_at: string | null
  call_time: string | null
  tech_check_at: string | null
}

export interface KitCheck {
  video_id: string
  item: string
  done: boolean
}

export interface CalendarEvent {
  id: string
  kind: EventKind
  title: string
  starts_at: string
  ends_at: string
  video_id: string | null
  attendee_ids: string[]
}

export interface Marker {
  id: string
  video_id: string
  timecode_s: number
  note: string
  author_id: string
  created_at: string
}

export interface Device {
  id: string
  owner_id: string
  name: string
  has_footage_root: boolean
  last_seen_at: string | null
}

export interface DeviceFile {
  device_id: string
  video_id: string
  kind: FileKind
  rel_path: string
  bytes: number
  sha256: string
  seen_at: string
}

export interface Job {
  id: string
  kind: JobKind
  video_id: string
  target_device_id: string
  status: JobStatus
  progress: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface EditDecision {
  id: string
  video_id: string
  kind: 'cut' | 'reorder' | 'cold_open'
  start_s: number
  end_s: number
  reason: string
  status: DecisionStatus
}

export interface RiskFlag {
  id: string
  video_id: string
  kind: 'legal' | 'copyright' | 'language' | 'sensitive'
  start_s: number
  end_s: number
  note: string
  status: 'open' | 'acknowledged' | 'resolved'
}

export interface StyleProfile {
  show_id: string
  edit_type: EditType
  profile: Record<string, unknown>
  updated_at: string
}

export interface Correction {
  id: string
  video_id: string
  kind: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  author_id: string
  created_at: string
}

export interface Comment {
  id: string
  video_id: string
  timecode_s: number | null
  body: string
  author_id: string
  resolved_at: string | null
  created_at: string
}

export interface Approval {
  id: string
  subject_type: string
  subject_id: string
  required_permission: Permission
  assigned_position_id: string
  status: 'pending' | 'approved' | 'rejected' | 'escalated'
  escalates_at: string | null
  decided_by: string | null
  decided_at: string | null
}

export interface Asset {
  id: string
  show_id: string | null
  kind: AssetKind
  name: string
  template: Record<string, unknown> | null
  storage_key: string
  version: number
  created_by: string
  created_at: string
}

export interface BrandKit {
  id: string
  show_id: string
  colours: Record<string, string>
  fonts: Record<string, string>
  logo_asset_id: string | null
}

export interface Clip {
  id: string
  video_id: string
  start_s: number
  end_s: number
  score: number
  reason: string
  source: ClipSource
  hook: string | null
  caption_style: string | null
  status: ClipStatus
  storage_key: string | null
}

export interface Destination {
  id: string
  show_id: string
  platform: Platform
  default_mode: PublishMode
  account_ref: string
}

export interface Package {
  id: string
  video_id: string | null
  clip_id: string | null
  platform: Platform
  title: string
  description: string
  tags: string[]
  thumbnail_asset_id: string | null
  publish_at: string | null
  mode: PublishMode
  status: PackageStatus
  external_id: string | null
  post_url: string | null
  attempts: number
}

export interface PlatformApproval {
  platform: Platform
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected'
  submitted_at: string | null
  feedback: string | null
  next_action: string | null
  updated_by: string | null
}

export interface MetricsSnapshot {
  id: string
  package_id: string
  platform: Platform
  captured_at: string
  metrics: Record<string, unknown>
}

export interface Thread {
  id: string
  kind: ThreadKind
  video_id: string | null
  name: string | null
}

export interface ThreadMember {
  thread_id: string
  person_id: string
  notify: NotifyLevel
  last_read_at: string | null
}

export interface Message {
  id: string
  thread_id: string
  author_id: string | null
  body: string
  attachments: MessageAttachment[] | null
  created_at: string
}

export interface MessageAttachment {
  type: 'video' | 'clip' | 'file' | 'action_card'
  ref_id?: string
  timecode_s?: number
  url?: string
  filename?: string
  bytes?: number
}

export interface PushSubscription {
  id: string
  person_id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  platform: 'web' | 'ios' | 'android'
}

export type WidgetSize = 'S' | 'M' | 'Tall' | 'L' | 'Wide'

export interface DashboardWidget {
  widget: string
  size: WidgetSize
}

export interface DashboardLayout {
  person_id: string
  layout: DashboardWidget[]
}

export interface RoleLayout {
  role: RoleType
  layout: DashboardWidget[]
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  subject_type: string
  subject_id: string
  data: Record<string, unknown>
  at: string
}

// Insert types (used when creating new rows)
export type InsertVideo = Omit<Video, 'id' | 'created_at'>
export type InsertProfile = Omit<Profile, 'id' | 'created_at'>
export type InsertCalendarEvent = Omit<CalendarEvent, 'id'>
export type InsertMessage = Omit<Message, 'id' | 'created_at'>
export type InsertThread = Omit<Thread, 'id'>
export type InsertJob = Omit<Job, 'id' | 'created_at' | 'updated_at'>
export type InsertClip = Omit<Clip, 'id'>
export type InsertPackage = Omit<Package, 'id'>
