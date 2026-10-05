export interface NavItem {
  id: string
  label: string
  icon: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}
