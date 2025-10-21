export async function runPool<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, size: number): Promise<R[]> {
  const results: R[] = []
  let i = 0
  async function runner() {
    while (true) {
      const idx = i++
      if (idx >= items.length) break
      const res = await worker(items[idx], idx)
      results[idx] = res
    }
  }
  const workers = new Array(Math.max(1, size)).fill(0).map(() => runner())
  await Promise.all(workers)
  return results
}
