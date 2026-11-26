'use client'

import { useSyncExternalStore } from 'react'
import { iglooSnapshot, subscribeIgloos, type IglooTone } from './igloo-store'

export function IglooEmblem({ tone }: { tone: IglooTone }) {
  const urls = useSyncExternalStore(subscribeIgloos, iglooSnapshot, () => null)
  const src = urls?.[tone]
  if (!src) return <span className="size-8 rounded-full bg-sky-200/30" aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element -- baked WebGL emblem, not a remote image
  return <img src={src} alt="" className="size-10" />
}
