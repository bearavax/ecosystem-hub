import type { ReactNode } from 'react'
import { WireNav } from './_components/wire-nav'
import { loadPolarisContext } from './_lib/queries'

export default async function PolarisLayout({ children }: { children: ReactNode }) {
  const ctx = await loadPolarisContext()
  if (!ctx) return <div className="container-page py-12">{children}</div>
  return (
    <div className="container-page py-8">
      <p className="text-sm text-fg-muted">Polaris wireframe. Dates TBC. Prize amounts are proposed. Local test data only.</p>
      <h1 className="mt-1 text-2xl text-fg-heading">Polaris</h1>
      <WireNav />
      {children}
    </div>
  )
}
