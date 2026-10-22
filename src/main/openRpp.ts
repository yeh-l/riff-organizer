import { BrowserWindow, dialog } from "electron"
import { dirname, isAbsolute, resolve, join, normalize } from "path"
import { createReadStream, existsSync, statSync } from "fs"
import readline from "readline"
import { readdir } from "fs/promises"
import type { Item, Project, ScanResult } from "../shared/types"

// User chooses a directory to add as a scan path
export async function handleScanFolder(): Promise<ScanResult | undefined> {
  const mainWindow = BrowserWindow.getFocusedWindow()

  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"]
  })

  if (result.canceled) return

  const scanPath = result.filePaths[0]
  const projectPaths = await findRppFiles(scanPath)

  return {
    scanPath,
    projectPaths
  }
}

// Return all projects in paths

export async function importProjects(paths: string[]): Promise<Project[]> {
  const projects: Project[] = []
  const seenItems = new Set<string>()

  for (const path of paths) {
    try {
      const project = await parseRPP(path)
      project.items = project.items.filter((item) => {
        if (!item.guid || !item.filePath) return true

        const key = JSON.stringify([item.guid, normalize(item.filePath).toLowerCase()])
        if (seenItems.has(key)) return false

        seenItems.add(key)
        return true
      })
      projects.push(project)
    } catch (error) {
      console.error(`Failed to parse ${path}:`, error)
    }
  }

  return projects
}

// Recursively finds every .rpp file inside a directory
export async function findRppFiles(folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true })

  const rppFiles: string[] = []

  for (const entry of entries) {
    const fullPath = join(folderPath, entry.name)

    if (entry.isDirectory()) {
      const files = await findRppFiles(fullPath)
      rppFiles.push(...files)
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".rpp") &&
      !entry.name.startsWith("._")
    ) {
      rppFiles.push(fullPath)
    }
  }
  return rppFiles
}

// return a Project object containing the RPP file path and an array of media items
async function parseRPP(rppPath: string): Promise<Project> {
  const stream = createReadStream(rppPath)

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  })

  const items: Item[] = []
  const tempos: { position: number; bpm: number }[] = []
  let currentItem: Item = {
    guid: null,
    bpm: null,
    position: null,
    length: null,
    filePath: null,
    fileBirthtime: null,
    sourceOffset: null
  }
  let insideSOURCE = false // Flag to indicate if we are inside a <SOURCE ...> block
  let insideTempoEnvelope = false // Flag to indicate if we are inside a <TEMPOENVEX> block

  for await (const line of rl) {
    const text = line.trim()

    if (insideSOURCE) {
      // If we are inside a <SOURCE ...> block, get the file path
      currentItem.filePath = text.match(/"(.*)"/)?.[1] || null
      if (!currentItem.filePath) {
        console.error("Failed to extract file path:", {
          project: rppPath,
          line: text,
          item: currentItem
        })
      } else if (!isAbsolute(currentItem.filePath))
        currentItem.filePath = resolve(dirname(rppPath), currentItem.filePath)

      insideSOURCE = false
      continue
    }

    if (text.startsWith("IGUID ")) {
      currentItem.guid = text.split(/\s+/)[1]
      continue
    }

    if (text.startsWith("POSITION")) {
      currentItem.position = Math.round(Number(text.split(" ")[1]) * 100) / 100
      continue
    }

    if (text.startsWith("LENGTH")) {
      currentItem.length = Math.round(Number(text.split(" ")[1]) * 100) / 100
      continue
    }

    if (text.startsWith("SOFFS")) {
      currentItem.sourceOffset = Math.round(Number(text.split(" ")[1]) * 100) / 100
      continue
    }

    if (text.startsWith("<SOURCE ")) {
      insideSOURCE = !text.startsWith("<SOURCE MIDI")
      continue
    }

    if (text.startsWith("<ITEM")) {
      // Start of a new item, push the previous one if it exists
      pushCurrentItem()
      currentItem = {
        guid: null,
        bpm: null,
        position: null,
        length: null,
        filePath: null,
        fileBirthtime: null,
        sourceOffset: null
      }
      continue
    }

    const parseBpm = (value: string): number => Math.min(Math.round(Number(value) * 100) / 100, 999)

    if (text.startsWith("TEMPO ")) {
      // Push the initial tempo marker
      const parts = text.split(/\s+/)
      tempos.push({
        position: 0,
        bpm: parseBpm(parts[1])
      })
    }

    if (text.startsWith("<TEMPOENVEX")) {
      insideTempoEnvelope = true
      continue
    }

    if (insideTempoEnvelope && text.startsWith(">")) {
      insideTempoEnvelope = false
      continue
    }

    if (insideTempoEnvelope && text.startsWith("PT ")) {
      // Push the rest of the tempo markers, ignoring the first one
      const parts = text.split(/\s+/)
      if (Number(parts[1]) !== 0) {
        tempos.push({
          position: Math.round(Number(parts[1]) * 100) / 100,
          bpm: parseBpm(parts[2])
        })
      }
    }
  }

  pushCurrentItem() // Push the final current item

  const filteredItems = removeOverlappingItems(items)
  assignTempos(filteredItems, tempos)
  //sort items by file birthtime, then by file path
  filteredItems.sort((a, b) => {
    const aBirthtime = Number.isFinite(a.fileBirthtime)
      ? a.fileBirthtime!
      : Number.POSITIVE_INFINITY
    const bBirthtime = Number.isFinite(b.fileBirthtime)
      ? b.fileBirthtime!
      : Number.POSITIVE_INFINITY

    const birthtimeOrder = aBirthtime - bBirthtime

    if (birthtimeOrder !== 0) return birthtimeOrder

    return (a.filePath ?? "").localeCompare(b.filePath ?? "", undefined, {
      sensitivity: "base"
    })
  })

  return { rppPath, items: filteredItems }

  // Add item to list if longer than 1s and file exists
  function pushCurrentItem(): void {
    if (
      currentItem.filePath === null ||
      currentItem.position === null ||
      !Number.isFinite(currentItem.position) ||
      currentItem.length === null ||
      !Number.isFinite(currentItem.length) ||
      currentItem.length <= 1
    ) {
      return
    }

    if (!existsSync(currentItem.filePath)) {
      console.warn("Audio file not found:", currentItem.filePath)
      return
    }

    currentItem.fileBirthtime = statSync(currentItem.filePath).birthtimeMs
    items.push(currentItem)
  }
}

// Assign tempos to items based on their positions relative to the tempo markers.
const assignTempos = (items: Item[], tempos: { position: number; bpm: number }[]): void => {
  // Items are parsed in track order, so assign tempos in timeline order instead.
  const sortedItems = [...items].sort(
    (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)
  )
  tempos.sort((a, b) => a.position - b.position)

  let tempoIndex = 0
  let currentTempo: number | null = null

  for (const item of sortedItems) {
    if (item.position === null) {
      item.bpm = null
      continue
    }

    while (tempoIndex < tempos.length && tempos[tempoIndex].position <= item.position) {
      currentTempo = tempos[tempoIndex].bpm
      tempoIndex++
    }

    item.bpm = currentTempo
  }
}

// Keep only the first occurrence of an item in case of overlapping items on different tracks (or same track).
const removeOverlappingItems = (items: Item[]): Item[] => {
  const keptItems: Item[] = []
  for (const item of items) {
    if (
      item.position === null ||
      !Number.isFinite(item.position) ||
      item.length === null ||
      !Number.isFinite(item.length)
    ) {
      continue
    }

    let isDuplicate = false
    for (const keptItem of keptItems) {
      const overlapStart = Math.max(item.position, keptItem.position!)
      const overlapEnd = Math.min(
        item.position + item.length,
        keptItem.position! + keptItem.length!
      )
      if (overlapEnd - overlapStart <= 0) {
        // No overlap
        continue
      }
      if (overlapEnd - overlapStart > 1) {
        // If the overlap is more than 1 second, consider it a duplicate
        isDuplicate = true
      }
    }
    if (!isDuplicate) {
      keptItems.push(item)
    }
  }
  return keptItems
}
