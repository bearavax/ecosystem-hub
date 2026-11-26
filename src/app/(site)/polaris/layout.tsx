import type { ReactNode } from 'react'
import { PolarisFrame } from './_components/frame'
import { Aurora } from './_components/aurora'
import { SvalbardBackdrop } from './_components/svalbard-world'
import { loadPolarisContext } from './_lib/queries'

export default async function PolarisLayout({ children }: { children: ReactNode }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return <div className="container-page py-12">{children}</div>
  return (
    <div className="relative bg-[linear-gradient(180deg,#060E1B_0%,#0B192C_100%)]">
      <div className="pointer-events-none sticky top-16 z-0 -mb-[calc(100dvh-4rem)] h-[calc(100dvh-4rem)]">
        <SvalbardBackdrop />
      </div>
      <div className="relative z-10">
        <PolarisFrame header={<Aurora h={ctx.h} user={ctx.user} mine={ctx.mine} />}>
          {children}
        </PolarisFrame>
      </div>
    </div>
  )
}
