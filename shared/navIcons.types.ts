import type { NavIconId } from './navItems'

export interface NavIcon {
  innerHTML: string
  viewBox: string
}

export interface DiscoveredNavItem {
  id: NavIconId
  storageKey: string
  label: string
  icon: NavIcon
}

export const GET_NAV_ICONS = 'GET_NAV_ICONS' as const

export interface GetNavIconsResponse {
  items: DiscoveredNavItem[]
}
