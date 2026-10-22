import type { CustomGroup, Project, Item, Riff } from "../../shared/types"
import {
  getEffectiveBpm,
  getRiffGroups,
  hasManualBpm,
  isProjectHidden,
  loadMetadata,
  updateRiffGroups,
  updateRiffMetadata
} from "../src/metadata"
import { isCurrentRiff, isPlaying, loadRiff } from "../src/player"
import { attachRiffContextMenu } from "../src/riffContextMenu"
import { matchesSearch } from "../src/search"
import { createSelect, showConfirmDialog, showTextInputDialog, showToast } from "../src/ui"
import { createVirtualList, type VirtualList } from "../src/virtualList"
import {
  getBpmGroupLabel,
  groupRiffsByBpm,
  sortRiffs,
  type BpmGroupMode,
  type GroupMode,
  type SortMode
} from "../src/libraryData"

const riffList = document.querySelector<HTMLUListElement>("#riff-list")!
const projectFilters = document.querySelector<HTMLDivElement>("#project-filters")!
const favoritesButton = document.querySelector<HTMLButtonElement>("#favorites-button")!
const addGroupButton = document.querySelector<HTMLButtonElement>("#add-group-button")!
const groupFilters = document.querySelector<HTMLDivElement>("#group-filters")!
const riffSearchInput = document.querySelector<HTMLInputElement>("#riff-search")!

const groupByContainer = document.querySelector<HTMLDivElement>("#group-by-container")!
const groupByValue = createSelect("none", [
  { value: "none", label: "---" },
  { value: "bpm-exact", label: "BPM (exact)" },
  { value: "bpm-rounded", label: "BPM (rounded)" }
]) as HTMLInputElement
groupByContainer.appendChild(groupByValue)

const sortByContainer = document.querySelector<HTMLDivElement>("#sort-by-container")!

const sortByValue = createSelect("date", [
  { value: "date", label: "Recording Date" },
  { value: "position", label: "Time Position" },
  { value: "name", label: "File Name" },
  { value: "project", label: "Project Name" },
  { value: "bpm", label: "BPM" }
]) as HTMLInputElement
sortByContainer.appendChild(sortByValue)

let projects: Project[] = []
let customGroups: CustomGroup[] = []
let favoritesGroupId: number | null = null

let selectedProject: string | null = null
let selectedGroupId: number | null = null

let activeRowPlayButton: HTMLButtonElement | null = null

let groupMode: GroupMode = "none"
let sortMode: SortMode = "date"

let riffSearch = ""

let virtualList: VirtualList | null = null

const expandedBpmGroups = new Set<number | null>()

type BpmVirtualRow =
  | { kind: "group"; bpm: number | null; riffs: Riff[] }
  | { kind: "riff"; riff: Riff }

export async function loadLibrary(): Promise<void> {
  showLibraryLoadingState()

  try {
    const [, groups] = await Promise.all([loadMetadata(), window.api.getAllCustomGroups()])

    customGroups = groups
    favoritesGroupId = groups.find((group) => group.isSystem)?.id ?? null

    const projectPaths = await scanAllProjectPaths()
    const visiblePaths = projectPaths.filter((path) => !isProjectHidden(path))
    const importedProjects = await window.api.importProjects(visiblePaths)

    projects = importedProjects
    renderLibrary()
  } catch (error) {
    console.error("Failed to load library:", error)
    riffList.innerHTML = `
      <li class="library-loading-state">
        <strong>Couldn't load projects</strong>
        <span>Check your scan folders and restart Riff Organizer.</span>
      </li>
    `
  }
}

function showLibraryLoadingState(): void {
  riffList.innerHTML = `
    <li class="library-loading-state" role="status" aria-live="polite">
      <span class="library-loading-spinner" aria-hidden="true"></span>
    </li>
  `
}

export async function scanAllProjectPaths(): Promise<string[]> {
  const scanPaths = await window.api.getScanPathsFromDB()
  const projectPaths = new Set<string>()

  for (const scanPath of scanPaths) {
    try {
      const foundProjects = await window.api.findRppFiles(scanPath)

      for (const path of foundProjects) {
        projectPaths.add(path)
      }
    } catch (error) {
      console.error(`Failed to scan ${scanPath}:`, error)
    }
  }

  return [...projectPaths]
}

export function renderLibrary(): void {
  renderCustomGroups()
  renderProjectFilters()
  syncFilterButtonStates()
  renderRiffs()
}

groupByValue.addEventListener("change", () => {
  const value = groupByValue.querySelector<HTMLInputElement>('input[type="hidden"]')?.value

  groupMode = value === "bpm-exact" || value === "bpm-rounded" ? value : "none"

  renderRiffs()
})

sortByValue.addEventListener("change", () => {
  const value = sortByValue.querySelector<HTMLInputElement>('input[type="hidden"]')?.value

  sortMode = (value ?? "date") as SortMode
  renderRiffs()
})

function renderRiffs(): void {
  virtualList?.destroy()
  virtualList = null

  riffList.innerHTML = ""

  let riffs = getVisibleRiffs()

  riffs = riffs.filter(({ item }) => {
    const fileName = item.filePath?.split(/[\\/]/).pop() ?? ""

    return matchesSearch(fileName, riffSearch)
  })

  sortRiffs(riffs, sortMode)

  if (riffs.length === 0) {
    const hasActiveFilter =
      riffSearch.trim().length > 0 || selectedProject !== null || selectedGroupId !== null
    const isEmptyCustomGroup =
      selectedGroupId !== null &&
      customGroups.some((group) => group.id === selectedGroupId && !group.isSystem) &&
      riffSearch.trim().length === 0 &&
      selectedProject === null

    renderEmptyState(hasActiveFilter, isEmptyCustomGroup)
    return
  }

  if (groupMode === "none") {
    renderVirtualizedRiffs(riffs)
    return
  }

  virtualList = renderBpmGroups(riffs, groupMode)
}

function renderEmptyState(hasActiveFilter: boolean, isEmptyCustomGroup: boolean): void {
  const state = document.createElement("li")
  state.classList.add("empty-library-state")

  state.innerHTML = `
    <svg class="empty-library-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M8 20a4 4 0 0 1 4-4h14l6 7h20a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20Z" />
      <path d="M8 27h48" />
    </svg>
    <strong>Nothing here</strong>
    <span>${isEmptyCustomGroup ? "Right-click a riff and choose “Assign to riff group” to add it here." : hasActiveFilter ? "No riffs match your current filters." : "Add a scan folder in Settings to find your riffs."}</span>
    ${
      hasActiveFilter
        ? '<button type="button" class="btn" data-clear-filters>Clear filters</button>'
        : '<button type="button" class="btn" data-empty-open-settings>Open Settings</button>'
    }
  `

  riffList.appendChild(state)

  state
    .querySelector<HTMLButtonElement>("[data-empty-open-settings]")
    ?.addEventListener("click", () => {
      document.querySelector<HTMLButtonElement>("#settings-button")?.click()
    })

  state.querySelector<HTMLButtonElement>("[data-clear-filters]")?.addEventListener("click", () => {
    selectedProject = null
    selectedGroupId = null

    riffSearchInput.value = ""
    riffSearch = ""

    syncFilterButtonStates()
    renderRiffs()
  })
}

function renderBpmGroups(riffs: Riff[], groupMode: BpmGroupMode): VirtualList {
  const groups = groupRiffsByBpm(riffs, groupMode)
  const rows: BpmVirtualRow[] = []

  for (const { bpm, riffs: groupedRiffs } of groups) {
    rows.push({ kind: "group", bpm, riffs: groupedRiffs })

    if (expandedBpmGroups.has(bpm)) {
      for (const riff of groupedRiffs) {
        rows.push({ kind: "riff", riff })
      }
    }
  }

  return createVirtualList({
    container: riffList,
    items: rows,
    rowHeight: 46,
    overscan: 10,
    createRow: (row) => {
      if (row.kind === "riff") {
        return createRiffRow(row.riff.item, row.riff.project)
      }

      const details = document.createElement("details")
      details.classList.add("riff-group")
      details.open = expandedBpmGroups.has(row.bpm)

      const summary = document.createElement("summary")
      const label = document.createElement("span")
      label.textContent = `${getBpmGroupLabel(row.bpm, row.riffs, groupMode)} (${row.riffs.length})`

      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      chevron.setAttribute("class", "lucide lucide-chevron-down")
      chevron.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      chevron.setAttribute("width", "16")
      chevron.setAttribute("height", "16")
      chevron.setAttribute("viewBox", "0 0 24 24")
      chevron.setAttribute("fill", "none")
      chevron.setAttribute("stroke", "currentColor")
      chevron.setAttribute("stroke-width", "2")
      chevron.setAttribute("stroke-linecap", "round")
      chevron.setAttribute("stroke-linejoin", "round")

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", "m6 9 6 6 6-6")
      chevron.appendChild(path)

      summary.append(chevron, label)
      summary.addEventListener("click", (event) => {
        event.preventDefault()

        if (expandedBpmGroups.has(row.bpm)) {
          expandedBpmGroups.delete(row.bpm)
        } else {
          expandedBpmGroups.add(row.bpm)
        }

        renderRiffs()
      })

      details.appendChild(summary)
      return details
    }
  })
}

function getVisibleRiffs(): Riff[] {
  const visibleProjects = projects.filter((project) => {
    if (isProjectHidden(project.rppPath)) {
      return false
    }

    if (selectedProject !== null) {
      return project.rppPath === selectedProject
    }

    return true
  })

  let riffs = visibleProjects.flatMap((project) =>
    project.items.map((item) => ({
      item,
      project
    }))
  )

  if (selectedGroupId !== null) {
    riffs = riffs.filter((riff) =>
      getRiffGroups(riff.item, riff.project).includes(selectedGroupId!)
    )
  }

  return riffs
}

function renderVirtualizedRiffs(riffs: Riff[]): void {
  virtualList = createVirtualList({
    container: riffList,
    items: riffs,
    rowHeight: 46,
    overscan: 10,
    createRow: (riff) => createRiffRow(riff.item, riff.project)
  })
}

function renderCustomGroups(): void {
  groupFilters.replaceChildren()

  for (const group of customGroups) {
    if (group.isSystem) continue

    const button = document.createElement("button")
    button.classList.add("btn", "project-button")
    button.dataset.groupId = group.id.toString()

    const groupName = document.createElement("span")
    groupName.classList.add("group-name")
    groupName.textContent = group.name
    button.appendChild(groupName)

    const renameButton = document.createElement("span")
    renameButton.classList.add("group-rename-button")
    renameButton.setAttribute("role", "button")
    renameButton.setAttribute("tabindex", "0")
    renameButton.setAttribute("aria-label", `Rename riff group ${group.name}`)
    renameButton.textContent = "✎"

    const renameGroup = async (event: Event): Promise<void> => {
      event.stopPropagation()

      const newName = await showTextInputDialog("Rename riff group", group.name)
      if (!newName || newName === group.name) return

      const nameExists = customGroups.some(
        (item) => item.id !== group.id && item.name.toLowerCase() === newName.toLowerCase()
      )

      if (nameExists) {
        showToast("A riff group with this name already exists", "error")
        return
      }

      try {
        await window.api.renameCustomGroup(group.id, newName)

        customGroups = customGroups
          .map((item) => (item.id === group.id ? { ...item, name: newName } : item))
          .sort((a, b) => a.name.localeCompare(b.name))

        renderCustomGroups()
        syncFilterButtonStates()
      } catch (error) {
        console.error("Failed to rename riff group:", error)
        showToast("Could not rename riff group", "error")
      }
    }

    renameButton.addEventListener("click", renameGroup)
    renameButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return

      event.preventDefault()
      void renameGroup(event)
    })

    button.appendChild(renameButton)

    const deleteButton = document.createElement("span")
    deleteButton.classList.add("group-delete-button")
    deleteButton.setAttribute("aria-label", `Delete riff group ${group.name}`)
    deleteButton.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    `
    button.appendChild(deleteButton)

    button.addEventListener("click", () => {
      selectGroup(group.id)
    })

    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation()

      const confirmed = await showConfirmDialog(
        "Delete riff group?",
        `Delete "${group.name}"? Riffs will not be deleted.`
      )

      if (!confirmed) return

      await window.api.deleteCustomGroup(group.id)
      customGroups = customGroups.filter((item) => item.id !== group.id)

      if (selectedGroupId === group.id) selectedGroupId = null

      renderCustomGroups()
      syncFilterButtonStates()
      renderRiffs()
    })

    groupFilters.appendChild(button)
  }
}

function renderProjectFilters(): void {
  projectFilters.replaceChildren()

  const visibleProjects = projects.filter((project) => !isProjectHidden(project.rppPath))

  for (const project of visibleProjects) {
    const button = document.createElement("button")
    button.classList.add("btn", "project-button")
    button.dataset.projectPath = project.rppPath

    button.textContent =
      project.rppPath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.rpp$/i, "") ?? "Project"

    button.addEventListener("click", () => {
      selectProject(project.rppPath)
    })

    projectFilters.appendChild(button)
  }
}

function syncFilterButtonStates(): void {
  projectFilters.querySelectorAll<HTMLButtonElement>(".project-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.projectPath === selectedProject)
  })

  groupFilters.querySelectorAll<HTMLButtonElement>(".project-button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.groupId) === selectedGroupId)
  })

  const favoritesSelected = selectedGroupId === favoritesGroupId
  favoritesButton.classList.toggle("active", favoritesSelected)
  favoritesButton.textContent = favoritesSelected ? "★ Favorites" : "☆ Favorites"
}

function selectProject(projectPath: string): void {
  selectedProject = selectedProject === projectPath ? null : projectPath

  syncFilterButtonStates()
  renderRiffs()
}

function selectGroup(groupId: number): void {
  const isActive = selectedGroupId === groupId

  if (isActive) {
    selectedGroupId = null
  } else {
    selectedGroupId = groupId
  }

  syncFilterButtonStates()
  renderRiffs()
}

// Return an li representing a riff
function createRiffRow(item: Item, project: Project): HTMLLIElement {
  const row = document.createElement("li")
  row.classList.add("riff-row")

  const playButton = document.createElement("button")
  playButton.classList.add("btn", "play-button")
  playButton.textContent = isCurrentRiff(item) && isPlaying() ? "⏸︎" : "\u25B6\uFE0E"
  playButton.dataset.riffGuid = item.guid ?? ""

  const favoriteButton = document.createElement("button")
  favoriteButton.classList.add("favorite-button", "btn")

  const favorite =
    favoritesGroupId !== null && getRiffGroups(item, project).includes(favoritesGroupId)
  favoriteButton.classList.toggle("active", favorite)
  favoriteButton.textContent = favorite ? "★" : "☆"

  const fileName = document.createElement("span")
  fileName.classList.add("riff-name")
  fileName.classList.toggle("playing", isCurrentRiff(item))
  fileName.textContent = item.filePath?.split(/[\\/]/).pop() ?? "Unknown"

  const projectName = document.createElement("div")
  projectName.classList.add("riff-project")

  const projectNameText = document.createElement("span")
  projectNameText.classList.add("riff-project-text")
  projectNameText.textContent =
    project.rppPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.rpp$/i, "") ?? project.rppPath

  projectName.append(projectNameText)

  const spacer = document.createElement("div")

  const bpm = document.createElement("span")
  bpm.classList.add("riff-bpm")
  updateBpmDisplay(bpm, item, project)

  row.append(playButton, favoriteButton, fileName, projectName, spacer, bpm)

  attachRiffContextMenu(row, item, project, {
    getCustomGroups: () => customGroups,
    onGroupsChanged: renderRiffs
  })

  playButton.addEventListener("click", (event) => {
    event.stopPropagation()

    if (activeRowPlayButton && activeRowPlayButton !== playButton) {
      activeRowPlayButton.textContent = "\u25B6\uFE0E"
    }

    activeRowPlayButton = playButton
    loadRiff(item)
  })

  favoriteButton.addEventListener("click", async (event) => {
    event.stopPropagation()

    if (item.guid === null) return

    if (favoritesGroupId === null) return

    const groupIds = getRiffGroups(item, project)
    const newFavorite = !groupIds.includes(favoritesGroupId)
    const updatedGroupIds = newFavorite
      ? [...groupIds, favoritesGroupId]
      : groupIds.filter((groupId) => groupId !== favoritesGroupId)

    await window.api.setRiffGroups(project.rppPath, item.guid, updatedGroupIds)

    updateRiffGroups(`${project.rppPath}:${item.guid}`, updatedGroupIds)

    if (selectedGroupId === favoritesGroupId) {
      renderRiffs()
      return
    }

    renderRiffs()
  })

  bpm.addEventListener("dblclick", () => {
    if (item.guid === null) return

    const input = document.createElement("input")
    input.type = "number"
    input.classList.add("riff-bpm-input")
    input.min = "1"
    input.max = "999"

    const currentBpm = getEffectiveBpm(item, project)
    input.value = currentBpm?.toString() ?? ""

    input.addEventListener("input", () => {
      if (input.value !== "" && Number(input.value) > 999) {
        input.value = "999"
      }
    })

    bpm.replaceWith(input)

    input.focus()
    input.select()

    const save = async (): Promise<void> => {
      const value = input.value.trim()

      if (value === "") {
        await window.api.setRiffBpm(project.rppPath, item.guid!, null)

        updateRiffMetadata(`${project.rppPath}:${item.guid}`, {
          manualBpm: null
        })

        updateBpmDisplay(bpm, item, project)
        input.replaceWith(bpm)
        return
      }

      const newBpm = Math.min(Number(value), 999)

      if (!Number.isFinite(newBpm) || newBpm <= 0) {
        input.replaceWith(bpm)
        return
      }

      await window.api.setRiffBpm(project.rppPath, item.guid!, newBpm)

      updateRiffMetadata(`${project.rppPath}:${item.guid}`, {
        manualBpm: newBpm
      })

      updateBpmDisplay(bpm, item, project)
      input.replaceWith(bpm)
    }

    input.addEventListener("blur", save)

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur()
      }
    })
  })

  return row
}

favoritesButton.addEventListener("click", () => {
  if (favoritesGroupId === null) return

  selectGroup(favoritesGroupId)

  syncFilterButtonStates()
  renderRiffs()
})

addGroupButton.addEventListener("click", async () => {
  const name = await showTextInputDialog("Create riff group")
  if (!name) return

  const nameExists = customGroups.some((group) => group.name.toLowerCase() === name.toLowerCase())

  if (nameExists) {
    showToast("A riff group with this name already exists", "error")
    return
  }

  try {
    const group = await window.api.createCustomGroup(name)

    customGroups = [...customGroups, group].sort((a, b) => a.name.localeCompare(b.name))

    renderCustomGroups()
    syncFilterButtonStates()
  } catch (error) {
    console.error("Failed to create custom group:", error)
    showToast("Could not create riff group", "error")
  }
})

riffSearchInput.addEventListener("input", () => {
  riffSearch = riffSearchInput.value
  renderRiffs()
})

function updateBpmDisplay(bpm: HTMLElement, item: Item, project: Project): void {
  const effectiveBpm = getEffectiveBpm(item, project)
  const manual = hasManualBpm(item, project)

  bpm.textContent =
    effectiveBpm === null ? "Insert BPM" : `${effectiveBpm} BPM${manual ? " *" : ""}`

  bpm.classList.toggle("unknown", effectiveBpm === null)
}

window.addEventListener("playback-change", (event) => {
  const { item, playing } = (event as CustomEvent).detail

  const rows = riffList.querySelectorAll<HTMLLIElement>(".riff-row")

  for (const row of rows) {
    const button = row.querySelector<HTMLButtonElement>(".play-button")
    const riffName = row.querySelector<HTMLElement>(".riff-name")

    if (!button) continue

    const isCurrent = item?.guid === button.dataset.riffGuid

    button.textContent = isCurrent && playing ? "⏸︎" : "\u25B6\uFE0E"

    riffName?.classList.toggle("playing", isCurrent)
  }
})
