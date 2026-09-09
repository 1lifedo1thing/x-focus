// 跨 context logger：统一的 console 输出入口
// 当前所有级别都走 console——后续可以接 storage 上报 / Sentry 等

export const logger = {
  debug(...args: unknown[]) {
    if (typeof console !== 'undefined') console.debug(...args)
  },
  warn(...args: unknown[]) {
    if (typeof console !== 'undefined') console.warn(...args)
  },
  error(...args: unknown[]) {
    if (typeof console !== 'undefined') console.error(...args)
  },
}
