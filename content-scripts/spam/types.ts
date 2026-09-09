import type { SpamRuleId } from '../../shared/spam-types'

export interface SpamConfig {
  threshold: number
  debug: boolean
  keywords: string[]
  enabledRules: Set<SpamRuleId>
  whitelist: Set<string>
  blacklist: Set<string>
}
