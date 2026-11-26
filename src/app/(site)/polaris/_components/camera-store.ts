export type PolarisShot = 'overview' | 'dens' | 'den' | 'stages' | 'lodge' | 'stars' | 'submit' | 'review'

let shot: PolarisShot = 'overview'
let stage = 1
let hover = -1

export function polarisShot() {
  return shot
}

export function polarisStage() {
  return stage
}

export function polarisHover() {
  return hover
}

export function setPolarisShot(next: PolarisShot, nextStage = 1) {
  shot = next
  stage = nextStage === 0 || nextStage === 2 ? nextStage : 1
}

export function setPolarisHover(index: number) {
  hover = index
}

export type PinPoint = { id: string; x: number; y: number; visible: boolean }

let project: ((pins: PinPoint[]) => void) | null = null

export function bindPins(fn: (pins: PinPoint[]) => void) {
  project = fn
  return () => {
    if (project === fn) project = null
  }
}

export function pushPins(pins: PinPoint[]) {
  project?.(pins)
}
