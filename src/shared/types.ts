export type Item = {
  guid: string | null
  position: number | null
  length: number | null
  sourceOffset: number | null
  filePath: string | null
  fileBirthtime: number | null
  bpm: number | null
}

export type Project = {
  rppPath: string
  items: Item[]
}

export type Riff = {
  item: Item
  project: Project
}

export type ScanResult = {
  scanPath: string
  projectPaths: string[]
}

export type StoredRiffMetadata = {
  projectPath: string
  itemGuid: string
  manualBpm: number | null
}

export type CustomGroup = {
  id: number
  name: string
  isSystem: boolean
}

export type StoredRiffGroupMembership = {
  groupId: number
  projectPath: string
  itemGuid: string
}

export type ProjectSettings = {
  projectPath: string
  hidden: boolean
  recordedToClick: boolean
}
