export type DoorSide = 'left' | 'right'

export interface DoorManifestEntry {
  id: string
  projectNumber: string
  memory: string
  name: string
  description: string
  sourceRoot: string
  projectPath: string
  entryKind: 'web' | 'godot' | 'renpy'
  entryUrl: string | null
  color: string
  side: DoorSide
  z: number
}

export type NexusPhase = 'browse' | 'opening' | 'opened'
