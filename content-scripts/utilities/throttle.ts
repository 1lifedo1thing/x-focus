export default function throttle<TArgs extends unknown[]>(func: (...args: TArgs) => void, limit: number) {
  let lastFunc: ReturnType<typeof setTimeout>
  let lastRan: number
  return function (this: unknown, ...args: TArgs) {
    if (!lastRan) {
      func.apply(this, args)
      lastRan = Date.now()
    } else {
      clearTimeout(lastFunc)
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args)
          lastRan = Date.now()
        }
      }, limit - (Date.now() - lastRan))
    }
  }
}
