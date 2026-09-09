import { collectProfileActivity, getProfileActivityRoute, summarizeProfileActivity } from '../../shared/profile-activity'
import { KeyProfileActivityStats } from '../../storage-keys'
import { setStorage } from '../utilities/storage'

let activeProfileHandle = ''
let lastSnapshot = ''
const seenEntries = new Map<string, ReturnType<typeof collectProfileActivity>[number]>()

/**
 * 累计当前会话中已加载的主页条目。只观察 DOM，不驱动页面滚动。
 */
export function updateProfileActivityStats() {
  const route = getProfileActivityRoute(window.location.pathname)
  if (!route) return

  if (route.profileHandle !== activeProfileHandle) {
    activeProfileHandle = route.profileHandle
    lastSnapshot = ''
    seenEntries.clear()
  }

  for (const entry of collectProfileActivity(document, route)) {
    seenEntries.set(`${entry.type}:${entry.id}`, entry)
  }

  const snapshot = JSON.stringify(summarizeProfileActivity(route.profileHandle, seenEntries.values()))
  if (snapshot === lastSnapshot) return
  lastSnapshot = snapshot
  void setStorage({ [KeyProfileActivityStats]: snapshot })
}
