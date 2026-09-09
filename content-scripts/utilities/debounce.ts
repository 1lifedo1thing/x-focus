export default function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void,
  timeout = 300,
) {
  let timer: ReturnType<typeof setTimeout>
  return function (this: unknown, ...args: TArgs) {
    clearTimeout(timer)
    timer = setTimeout(() => func.apply(this, args), timeout)
  }
}
