/**
 * MAIN world 拦截器 → isolated world 监听器的桥接常量。
 *
 * XF_BRIDGE_MARKER 不是真正的安全边界（同源页面理论上仍可读取并伪造），
 * 它的作用是：
 *  1. 防止其他脚本 / 扩展意外消费我们广播的用户数据；
 *  2. 让数据流意图显式，监听端必须校验此标记 + 来源才会处理。
 * 真正的隔离依赖 Chrome 的 content script isolated world 机制本身。
 */
export const XF_BRIDGE_MARKER = '__x_focus_bridge_v1__'

/** 排期数据 postMessage 的 type */
export const SCHEDULED_TWEETS_TYPE = 'XF_SCHEDULED_TWEETS'
