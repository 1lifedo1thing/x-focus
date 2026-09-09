import {
  KeySpamBlacklist,
  KeySpamDebugMode,
  KeySpamFilterEnabled,
  KeySpamKeywordList,
  KeySpamRulesEnabled,
  KeySpamThreshold,
  KeySpamWhitelist,
} from '../../storage-keys'
import { parseEnabledRules, parseHandleList, parseKeywordList } from '../../shared/spam-rules'
import type { SpamRuleId } from '../../shared/spam-types'
import { getStorage } from '../utilities/storage'
import type { SpamConfig } from './types'

function handleSet(raw: string | undefined | null): Set<string> {
  return new Set(parseHandleList(raw))
}

async function loadConfig(): Promise<SpamConfig | null> {
  const values = await getStorage([
    KeySpamFilterEnabled,
    KeySpamThreshold,
    KeySpamDebugMode,
    KeySpamKeywordList,
    KeySpamRulesEnabled,
    KeySpamWhitelist,
    KeySpamBlacklist,
  ])

  if (values[KeySpamFilterEnabled] !== 'on') return null

  return {
    threshold: Number(values[KeySpamThreshold]) || 55,
    debug: values[KeySpamDebugMode] === 'on',
    keywords: parseKeywordList(String(values[KeySpamKeywordList] ?? '')),
    enabledRules: parseEnabledRules(String(values[KeySpamRulesEnabled] ?? '')) as Set<SpamRuleId>,
    whitelist: handleSet(String(values[KeySpamWhitelist] ?? '')),
    blacklist: handleSet(String(values[KeySpamBlacklist] ?? '')),
  }
}

let cachedConfig: SpamConfig | null = null
let cachedAt = 0
const CONFIG_TTL = 5_000

export async function getSpamConfig(): Promise<SpamConfig | null> {
  if (cachedConfig && Date.now() - cachedAt < CONFIG_TTL) return cachedConfig
  cachedConfig = await loadConfig()
  cachedAt = Date.now()
  return cachedConfig
}

export function invalidateSpamConfigCache() {
  cachedConfig = null
  cachedAt = 0
}
