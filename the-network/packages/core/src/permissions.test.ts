import { describe, it, expect } from 'vitest'
import { roleHasPermission, getDefaultPermissions } from './permissions'

describe('roleHasPermission', () => {
  it('executives have all permissions', () => {
    expect(roleHasPermission('executive', 'approve_cut')).toBe(true)
    expect(roleHasPermission('executive', 'manage_users')).toBe(true)
    expect(roleHasPermission('executive', 'publish')).toBe(true)
  })

  it('viewers only have view_metrics', () => {
    expect(roleHasPermission('viewer', 'view_metrics')).toBe(true)
    expect(roleHasPermission('viewer', 'publish')).toBe(false)
    expect(roleHasPermission('viewer', 'manage_users')).toBe(false)
  })

  it('editors can run AI jobs but not publish', () => {
    expect(roleHasPermission('editor', 'run_ai_jobs')).toBe(true)
    expect(roleHasPermission('editor', 'publish')).toBe(false)
  })
})

describe('getDefaultPermissions', () => {
  it('returns an array, not a reference', () => {
    const perms1 = getDefaultPermissions('producer')
    const perms2 = getDefaultPermissions('producer')
    perms1.push('publish' as never)
    expect(perms2).not.toContain('publish')
  })
})
