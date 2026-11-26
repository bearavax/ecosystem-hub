'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function PolarisMast({ full, compact }: { full: ReactNode; compact: ReactNode }) {
  const path = usePathname()
  return path === '/polaris' ? full : compact
}
