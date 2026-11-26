'use client'

import type { ReactNode } from 'react'
import { setPolarisHover } from './camera-store'

export function IglooHover({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div onMouseEnter={() => setPolarisHover(index)} onMouseLeave={() => setPolarisHover(-1)}>
      {children}
    </div>
  )
}
