import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { PolarisExperience } from './_components/experience'
import { countDens, loadPolarisContext } from './_lib/queries'

export default async function PolarisLayout({ children }: { children: ReactNode }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return <div className="container-page py-12">{children}</div>
  const densTotal = await countDens(ctx.h.id)
  return (
    <Suspense fallback={children}>
      <PolarisExperience densTotal={densTotal}>{children}</PolarisExperience>
    </Suspense>
  )
}
