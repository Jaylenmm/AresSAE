type L = (...args: any[]) => void
export const logger: { info: L; warn: L; error: L; debug: L } = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => console.debug(...args)
}
