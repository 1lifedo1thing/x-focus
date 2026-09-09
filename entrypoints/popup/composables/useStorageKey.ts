import { ref, onMounted } from 'vue'
import { setStorage } from '../../../content-scripts/utilities/storage'

// ─── 微任务批处理器 ────────────────────────────────────────────────────────────
// 同一个 tick 内所有 useStorageKey/useStorageValue 的读取请求会被收集到
// pendingReads，在下一个微任务里一次性批量读取，消除多实例各自独立 IPC 的开销。
type Resolver = (value: string | number | boolean | undefined) => void

let pendingReads: Map<string, Resolver[]> | null = null

function batchedGetStorage(key: string): Promise<string | number | boolean | undefined> {
  return new Promise((resolve) => {
    if (!pendingReads) {
      pendingReads = new Map()
      // 在当前同步任务结束后、下一个微任务里统一发起一次 IPC
      queueMicrotask(async () => {
        const batch = pendingReads!
        pendingReads = null
        const keys = [...batch.keys()]
        try {
          const data = await browser.storage.local.get(keys)
          for (const [k, resolvers] of batch) {
            const raw = data[k] as string | number | boolean | undefined
            resolvers.forEach((r) => r(raw))
          }
        } catch {
          // 读取失败时全部 resolve undefined，让各自使用默认值
          for (const resolvers of batch.values()) {
            resolvers.forEach((r) => r(undefined))
          }
        }
      })
    }

    const resolvers = pendingReads.get(key) ?? []
    resolvers.push(resolve as Resolver)
    pendingReads.set(key, resolvers)
  })
}
// ──────────────────────────────────────────────────────────────────────────────

import { defaultPreferences } from '../../../storage-keys'
import type { SettingKey } from '../../../storage-keys'

function applyDefault(key: string, raw: string | number | boolean | undefined) {
  return raw ?? defaultPreferences[key as SettingKey]
}

export function useStorageKey(key: string) {
  const value = ref(false)
  const loaded = ref(false)

  onMounted(async () => {
    const raw = await batchedGetStorage(key)
    value.value = applyDefault(key, raw) === 'on'
    loaded.value = true
  })

  async function setValue(v: boolean) {
    value.value = v
    await setStorage({ [key]: v ? 'on' : 'off' })
  }

  return { value, loaded, setValue }
}

export function useStorageValue(key: string, fallback?: string) {
  const value = ref(fallback ?? '')

  onMounted(async () => {
    const raw = await batchedGetStorage(key)
    const resolved = applyDefault(key, raw)
    if (resolved !== undefined) {
      value.value = String(resolved)
    }
  })

  async function setValue(v: string) {
    value.value = v
    await setStorage({ [key]: v })
  }

  return { value, setValue }
}
