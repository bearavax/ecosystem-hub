import type { ReactNode } from 'react'
import { PolarisFrame } from './_components/frame'
import { Aurora } from './_components/aurora'
import { loadPolarisContext } from './_lib/queries'

export default async function PolarisLayout({ children }: { children: ReactNode }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return <div className="container-page py-12">{children}</div>
  return (
    <div className="bg-[linear-gradient(180deg,#07111F_0%,#0B192C_100%)]">
      <PolarisFrame header={<Aurora h={ctx.h} user={ctx.user} mine={ctx.mine} />}>
        {children}
      </PolarisFrame>
    </div>
  )
}
