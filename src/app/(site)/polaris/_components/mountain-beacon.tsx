/** Faceted ridge and a north-star beacon. CSS 3D only, no runtime. */
export function MountainBeacon() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 w-44 [perspective:520px] sm:right-8 sm:w-56" aria-hidden>
      <div className="absolute bottom-3 left-0 right-0 h-28 [transform-style:preserve-3d] motion-safe:[transform:rotateX(48deg)]">
        <span className="absolute bottom-0 left-1 h-16 w-20 bg-sky-200/25 [clip-path:polygon(50%_0,100%_100%,0_100%)] motion-safe:[transform:translateZ(6px)]" />
        <span className="absolute bottom-0 left-10 h-24 w-28 bg-sky-100/40 [clip-path:polygon(48%_0,100%_100%,0_100%)] motion-safe:[transform:translateZ(28px)]" />
        <span className="absolute bottom-0 right-1 h-14 w-20 bg-sky-300/30 [clip-path:polygon(52%_0,100%_100%,0_100%)] motion-safe:[transform:translateZ(12px)]" />
      </div>
      <span className="absolute right-16 top-5 size-2 rounded-full bg-amber-200 shadow-[0_0_18px_6px_rgba(251,191,36,0.75)]" />
    </div>
  )
}
