export type IglooTone = 'ice' | 'amber' | 'rose'
export type IglooUrls = Record<IglooTone, string>

let urls: IglooUrls | null = null
const listeners = new Set<() => void>()

export function publishIgloos(next: IglooUrls) {
  urls = next
  listeners.forEach((listener) => listener())
}

export function subscribeIgloos(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function iglooSnapshot() {
  return urls
}
