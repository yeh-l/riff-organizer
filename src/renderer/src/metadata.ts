import { Item, Project, ProjectSettings } from "../../shared/types"

type RiffMetadata = {
  manualBpm: number | null
}

let metadataMap = new Map<string, RiffMetadata>()
let projectSettingsMap = new Map<string, ProjectSettings>()
let groupMembershipMap = new Map<string, number[]>()

export async function loadMetadata(): Promise<void> {
  const riffMetadata = await window.api.getAllRiffMetadata()
  const projectSettings = await window.api.getAllProjectSettings()
  const memberships = await window.api.getAllRiffGroupMemberships()

  metadataMap = new Map(
    riffMetadata.map((metadata) => [
      `${metadata.projectPath}:${metadata.itemGuid}`,
      {
        manualBpm: metadata.manualBpm
      }
    ])
  )

  groupMembershipMap = new Map()
  for (const membership of memberships) {
    const key = `${membership.projectPath}:${membership.itemGuid}`
    const groupIds = groupMembershipMap.get(key) ?? []
    groupIds.push(membership.groupId)
    groupMembershipMap.set(key, groupIds)
  }

  projectSettingsMap = new Map(projectSettings.map((settings) => [settings.projectPath, settings]))
}

export function getEffectiveBpm(item: Item, project: Project): number | null {
  if (item.guid !== null) {
    const metadata = metadataMap.get(`${project.rppPath}:${item.guid}`)

    if (metadata?.manualBpm !== null && metadata?.manualBpm !== undefined) {
      return metadata.manualBpm
    }
  }

  const recordedToClick = projectSettingsMap.get(project.rppPath)?.recordedToClick ?? false

  return recordedToClick ? item.bpm : null
}

export function getRiffGroups(item: Item, project: Project): number[] {
  if (item.guid === null) return []

  return groupMembershipMap.get(`${project.rppPath}:${item.guid}`) ?? []
}

export function updateRiffGroups(key: string, groupIds: number[]): void {
  groupMembershipMap.set(key, groupIds)
}

export function isProjectHidden(projectPath: string): boolean {
  return projectSettingsMap.get(projectPath)?.hidden ?? true
}

export function updateRiffMetadata(key: string, updates: Partial<RiffMetadata>): void {
  const current = metadataMap.get(key) ?? {
    manualBpm: null
  }

  metadataMap.set(key, {
    ...current,
    ...updates
  })
}

export function hasManualBpm(item: Item, project: Project): boolean {
  if (item.guid === null) return false

  const manualBpm = metadataMap.get(`${project.rppPath}:${item.guid}`)?.manualBpm

  return manualBpm != null
}
