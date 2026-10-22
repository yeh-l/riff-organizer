import type { Project, Riff } from "../../shared/types"
import { getEffectiveBpm } from "./metadata"

export type GroupMode = "none" | "bpm-exact" | "bpm-rounded"
export type BpmGroupMode = Exclude<GroupMode, "none">
export type SortMode = "date" | "name" | "bpm" | "project" | "position"

export type BpmGroup = {
  bpm: number | null
  riffs: Riff[]
}

export function sortRiffs(riffs: Riff[], sortMode: SortMode): void {
  switch (sortMode) {
    case "name":
      riffs.sort((a, b) => {
        const aName = a.item.filePath?.split(/[\\/]/).pop() ?? ""
        const bName = b.item.filePath?.split(/[\\/]/).pop() ?? ""

        return aName.localeCompare(bName, undefined, {
          numeric: true,
          sensitivity: "base"
        })
      })
      break

    case "bpm":
      riffs.sort((a, b) => {
        const aBpm = getEffectiveBpm(a.item, a.project) ?? Infinity
        const bBpm = getEffectiveBpm(b.item, b.project) ?? Infinity

        return aBpm - bBpm
      })
      break

    case "project":
      riffs.sort((a, b) => {
        const aName = getProjectName(a.project)
        const bName = getProjectName(b.project)

        return aName.localeCompare(bName, undefined, {
          numeric: true,
          sensitivity: "base"
        })
      })
      break

    case "date":
      riffs.sort(compareByBirthtime)
      break

    case "position": {
      riffs.sort(compareByPosition)
    }
  }
}

export function groupRiffsByBpm(riffs: Riff[], groupMode: BpmGroupMode): BpmGroup[] {
  const groups = new Map<number | null, Riff[]>()

  for (const riff of riffs) {
    const bpm = getBpmGroupKey(riff, groupMode)

    if (!groups.has(bpm)) {
      groups.set(bpm, [])
    }

    groups.get(bpm)!.push(riff)
  }

  return [...groups.entries()]
    .sort(([bpmA], [bpmB]) => {
      if (bpmA === null) return 1
      if (bpmB === null) return -1

      return bpmA - bpmB
    })
    .map(([bpm, groupedRiffs]) => ({ bpm, riffs: groupedRiffs }))
}

export function getBpmGroupLabel(
  bpm: number | null,
  riffs: Riff[],
  groupMode: BpmGroupMode
): string {
  if (bpm === null) return "Unknown BPM"
  if (groupMode === "bpm-exact") return `${bpm} BPM`

  const bpms = riffs
    .map((riff) => getEffectiveBpm(riff.item, riff.project))
    .filter((value): value is number => value !== null)
  const minBpm = Math.min(...bpms)
  const maxBpm = Math.max(...bpms)

  return minBpm === maxBpm ? `${minBpm} BPM` : `${minBpm}-${maxBpm} BPM`
}

function getBpmGroupKey(riff: Riff, groupMode: BpmGroupMode): number | null {
  const bpm = getEffectiveBpm(riff.item, riff.project)

  if (bpm === null || groupMode === "bpm-exact") return bpm

  return Math.round(bpm / 5) * 5
}

function compareByBirthtime(a: Riff, b: Riff): number {
  const aBirthtime = Number.isFinite(a.item.fileBirthtime)
    ? a.item.fileBirthtime!
    : Number.POSITIVE_INFINITY
  const bBirthtime = Number.isFinite(b.item.fileBirthtime)
    ? b.item.fileBirthtime!
    : Number.POSITIVE_INFINITY

  const birthtimeOrder = aBirthtime - bBirthtime

  if (birthtimeOrder !== 0) return birthtimeOrder

  return (a.item.filePath ?? "").localeCompare(b.item.filePath ?? "", undefined, {
    sensitivity: "base"
  })
}

function compareByPosition(a: Riff, b: Riff): number {
  const projectA =
    a.project.rppPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.rpp$/i, "") ?? a.project.rppPath

  const projectB =
    b.project.rppPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.rpp$/i, "") ?? b.project.rppPath

  const projectCompare = projectA.localeCompare(projectB)

  if (projectCompare !== 0) {
    return projectCompare
  }

  const positionA = a.item.position
  const positionB = b.item.position

  if (positionA == null && positionB == null) return 0
  if (positionA == null) return 1
  if (positionB == null) return -1

  return positionA - positionB
}

function getProjectName(project: Project): string {
  return (
    project.rppPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.rpp$/i, "") ?? ""
  )
}
