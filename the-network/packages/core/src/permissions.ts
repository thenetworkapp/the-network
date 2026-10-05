import type { RoleType, Permission } from './types'

// Default permissions per role
const ROLE_DEFAULTS: Record<RoleType, Permission[]> = {
  executive: ['approve_cut', 'run_ai_jobs', 'approve_packaging', 'publish', 'manage_destinations', 'manage_users', 'view_metrics'],
  head:       ['approve_cut', 'run_ai_jobs', 'approve_packaging', 'publish', 'manage_destinations', 'view_metrics'],
  producer:   ['approve_cut', 'run_ai_jobs', 'approve_packaging', 'view_metrics'],
  editor:     ['run_ai_jobs'],
  designer:   [],
  host:       [],
  social:     ['publish'],
  viewer:     ['view_metrics'],
}

export function roleHasPermission(role: RoleType, permission: Permission): boolean {
  return ROLE_DEFAULTS[role]?.includes(permission) ?? false
}

export function getDefaultPermissions(role: RoleType): Permission[] {
  return [...(ROLE_DEFAULTS[role] ?? [])]
}

export const ALL_PERMISSIONS: Permission[] = [
  'approve_cut',
  'run_ai_jobs',
  'approve_packaging',
  'publish',
  'manage_destinations',
  'manage_users',
  'view_metrics',
]
