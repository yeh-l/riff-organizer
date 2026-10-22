import { loadLibrary, renderLibrary, scanAllProjectPaths } from "./library"
import { ProjectSettings } from "../../shared/types"
import { matchesSearch } from "../src/search"
import { showConfirmDialog } from "../src/ui"

let projectSearch = ""

export function createSettingsDialog(): HTMLElement {
  const dialog = document.createElement("dialog")
  dialog.id = "settings-dialog"
  dialog.classList.add("dialog")
  dialog.setAttribute("label", "Settings")

  dialog.innerHTML = `
    <div class="settings-dialog-panel">
      <button
        id="close-settings"
        type="button"
        class="btn"
        data-variant="ghost"
        data-size="icon-sm"
        aria-label="Close dialog"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
      <div class="settings-page">

        <div class="settings-content">
          <section class="settings-section">
            <h2>Settings</h2>

            <div class="settings-group">
              <div class="settings-group-header">
                <h3>Scan Paths</h3>
                <div class="settings-header-actions">
                  <button id="add-scan-path" class="btn" data-variant="outline">Add Folder</button>
                  <button id="rescan-library" class="btn" data-variant="outline">
                      Rescan
                  </button>
                </div>
              </div>

              <div id="scan-path-list" class="settings-list scrollbar-sm"></div>
            </div>

            <div class="settings-group projects-group">
              <div class="settings-group-header">
                 <div class="projects-title">
                   <h3>Projects</h3>
                   <span id="project-count"></span> 
                 </div>
                 <input
                    id="project-search"
                    class="input"
                    type="search"
                    placeholder="Search projects..."
                  />
              </div>

              

              <div class="project-settings-header">
                <span>Project</span>
                <span>Visible</span>
                <span class="inline-flex items-center gap-1 whitespace-nowrap">
                  Recorded to click?
                  <span class="info-icon tooltip" data-tooltip="Enable if the riffs were properly recorded to a click track in REAPER. This will automatically assign each riff the BPM it was recorded at." data-side="inline-start">
                    ⓘ
                  </span>
                </span>
              </div>

              <div id="project-settings-list" class="settings-list scrollbar-sm"></div>
            </div>
          </section>
        </div>

        <div class="project-settings-actions">
          <div class="project-settings-bulk-actions">
            <button id="bulk-toggle-visible-button" class="btn" data-variant="outline">
              Toggle all visible
            </button>
            <button id="bulk-select-all-click-button" class="btn" data-variant="outline">
              Mark all as recorded to click
            </button>
          </div>

          <div id="settings-applied-alert" class="alert absolute left-1/2 -translate-x-1/2 w-fit whitespace-nowrap px-2 py-1 text-xs text-emerald-100 bg-emerald-950 border-emerald-900 opacity-0 pointer-events-none transition-opacity duration-200" role="alert" aria-hidden="true">
                <svg
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
                  <path d="m5 12 4 4L19 6" />
                </svg>
                Settings applied
              </div>
              <button id="apply-project-settings" class="btn">Apply</button>
            </div>
        </div>
      </div>
    </div>
  `

  const closeButton = dialog.querySelector<HTMLButtonElement>("#close-settings")

  closeButton?.addEventListener("click", () => {
    dialog.close()
  })

  const rescanButton = dialog.querySelector<HTMLButtonElement>("#rescan-library")!

  rescanButton.addEventListener("click", async () => {
    await renderProjectSettings(dialog)
    await loadLibrary()
  })

  rescanButton.innerHTML = `
   <svg
     width="16"
     height="16"
     viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     stroke-width="2"
     stroke-linecap="round"
     stroke-linejoin="round"
     aria-hidden="true"
   >
     <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
     <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
   </svg>
  `

  rescanButton.setAttribute("aria-label", "Rescan")

  const addScanPathButton = dialog.querySelector<HTMLButtonElement>("#add-scan-path")

  addScanPathButton?.addEventListener("click", async () => {
    const result = await window.api.scanFolder()

    if (!result) return

    await window.api.addScanPathToDB(result.scanPath)

    await loadLibrary()

    await renderScanPaths(dialog)
    await renderProjectSettings(dialog)
  })

  const projectSearchInput = dialog.querySelector<HTMLInputElement>("#project-search")!

  // Search is temporary; reset it whenever Settings closes so reopening shows all projects.
  dialog.addEventListener("close", () => {
    projectSearch = ""
    projectSearchInput.value = ""
  })

  projectSearchInput.addEventListener("input", () => {
    projectSearch = projectSearchInput.value

    const rows = dialog.querySelectorAll<HTMLElement>(".project-settings-row")

    for (const row of rows) {
      const name = row.querySelector("span")?.textContent ?? ""
      row.hidden = !matchesSearch(name, projectSearch)
    }

    const visibleRows = Array.from(rows).filter((row) => !row.hidden)
    const header = dialog.querySelector<HTMLElement>(".project-settings-header")

    if (header) header.hidden = visibleRows.length === 0
  })

  const bulkToggleVisibleButton = dialog.querySelector<HTMLButtonElement>(
    "#bulk-toggle-visible-button"
  )!

  bulkToggleVisibleButton.addEventListener("click", () => {
    const rows = Array.from(dialog.querySelectorAll<HTMLElement>(".project-settings-row")).filter(
      (row) => !row.hidden
    )

    const allVisible = rows.every(
      (row) => row.querySelector<HTMLInputElement>(".project-visible")!.checked
    )

    for (const row of rows) {
      const checkbox = row.querySelector<HTMLInputElement>(".project-visible")!
      checkbox.checked = !allVisible
      row.classList.toggle("project-hidden", !checkbox.checked)
    }
  })

  const bulkSelectAllClickButton = dialog.querySelector<HTMLButtonElement>(
    "#bulk-select-all-click-button"
  )!

  bulkSelectAllClickButton.addEventListener("click", () => {
    const rows = Array.from(dialog.querySelectorAll<HTMLElement>(".project-settings-row")).filter(
      (row) => !row.hidden
    )

    const allRecorded = rows.every(
      (row) => row.querySelector<HTMLInputElement>(".project-click")!.checked
    )

    for (const row of rows) {
      const checkbox = row.querySelector<HTMLInputElement>(".project-click")!
      checkbox.checked = !allRecorded
    }
  })

  const applyButton = dialog.querySelector<HTMLButtonElement>("#apply-project-settings")
  const settingsAppliedAlert = dialog.querySelector<HTMLElement>("#settings-applied-alert")!
  let settingsAppliedAlertTimeout: ReturnType<typeof setTimeout> | undefined

  applyButton?.addEventListener("click", async () => {
    const rows = dialog.querySelectorAll<HTMLElement>(".project-settings-row")

    const settings: ProjectSettings[] = []

    for (const row of rows) {
      const projectPath = row.dataset.projectPath
      if (!projectPath) continue

      const visibleToggle = row.querySelector<HTMLInputElement>(".project-visible")!

      const clickCheckbox = row.querySelector<HTMLInputElement>(".project-click")!

      settings.push({
        projectPath,
        hidden: !visibleToggle.checked,
        recordedToClick: clickCheckbox.checked
      })
    }

    await window.api.updateProjectSettings(settings)

    settingsAppliedAlert.classList.remove("opacity-0", "pointer-events-none")
    settingsAppliedAlert.setAttribute("aria-hidden", "false")

    if (settingsAppliedAlertTimeout) {
      clearTimeout(settingsAppliedAlertTimeout)
    }

    settingsAppliedAlertTimeout = setTimeout(() => {
      settingsAppliedAlert.classList.add("opacity-0", "pointer-events-none")
      settingsAppliedAlert.setAttribute("aria-hidden", "true")
    }, 2000)

    await loadLibrary()
    await renderProjectSettings(dialog)
  })
  return dialog
}

export async function openSettings(): Promise<void> {
  const dialog = document.querySelector("#settings-dialog") as HTMLDialogElement

  dialog.showModal()

  await Promise.all([renderScanPaths(dialog), renderProjectSettings(dialog)])
}

export function closeSettings(): void {
  const dialog = document.querySelector("#settings-dialog") as HTMLDialogElement
  dialog.close()
}

async function renderScanPaths(dialog: HTMLElement): Promise<void> {
  const list = dialog.querySelector<HTMLElement>("#scan-path-list")

  if (!list) return

  const scanPaths = await window.api.getScanPathsFromDB()

  list.replaceChildren()

  for (const path of scanPaths) {
    const row = document.createElement("div")
    row.classList.add("settings-list-row")

    const folderIcon = document.createElement("span")

    folderIcon.innerHTML = `
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
      </svg>
    `

    const pathText = document.createElement("span")
    pathText.textContent = path

    const removeButton = document.createElement("button")
    removeButton.classList.add("btn", "remove-button")
    removeButton.textContent = "×"
    removeButton.innerHTML = `
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </svg>
    `

    removeButton.setAttribute("aria-label", "Remove scan path")

    removeButton.addEventListener("click", async () => {
      const scanPaths = await window.api.getScanPathsFromDB()

      // Projects found through the path we're about to remove
      const projectsInRemovedPath = await window.api.findRppFiles(path)

      // Find projects that will still exist through other scan paths
      const remainingProjects = new Set<string>()

      for (const scanPath of scanPaths) {
        if (scanPath === path) continue

        const foundProjects = await window.api.findRppFiles(scanPath)

        for (const projectPath of foundProjects) {
          remainingProjects.add(projectPath)
        }
      }

      const projectsToRemove = projectsInRemovedPath.filter(
        (projectPath) => !remainingProjects.has(projectPath)
      )

      const confirmed = await showConfirmDialog(
        "Remove scan path?",
        `This will remove ${projectsToRemove.length} project${
          projectsToRemove.length === 1 ? "" : "s"
        } from your library.`
      )

      if (!confirmed) return

      await window.api.removeScanPathFromDB(path, projectsToRemove)

      await loadLibrary()

      await renderScanPaths(dialog)
      await renderProjectSettings(dialog)

      renderLibrary()
    })

    const pathWrapper = document.createElement("div")
    pathWrapper.classList.add("scan-path-label")

    pathWrapper.append(folderIcon, pathText)

    row.append(pathWrapper, removeButton)

    list.appendChild(row)
  }
}

async function renderProjectSettings(dialog: HTMLElement): Promise<void> {
  const list = dialog.querySelector<HTMLElement>("#project-settings-list")

  if (!list) return

  const savedSettings = await window.api.getAllProjectSettings()

  const settingsMap = new Map(savedSettings.map((settings) => [settings.projectPath, settings]))

  const projectPaths = await scanAllProjectPaths()

  const projectCount = dialog.querySelector<HTMLElement>("#project-count")

  if (projectCount) {
    projectCount.textContent = `${projectPaths.length} found`
  }

  const getProjectName = (path: string): string =>
    path
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.rpp$/i, "") ?? path

  const sortedProjectPaths = [...projectPaths].sort((a, b) => {
    const aVisible = !(settingsMap.get(a)?.hidden ?? true)
    const bVisible = !(settingsMap.get(b)?.hidden ?? true)

    return (
      Number(bVisible) - Number(aVisible) ||
      getProjectName(a).localeCompare(getProjectName(b), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    )
  })

  const filteredProjectPaths = sortedProjectPaths.filter((path) => {
    const projectName =
      path
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.rpp$/i, "") ?? path

    return matchesSearch(projectName, projectSearch)
  })

  const projectSettingsHeader = dialog.querySelector<HTMLElement>(".project-settings-header")
  if (projectSettingsHeader) {
    projectSettingsHeader.hidden = filteredProjectPaths.length === 0
  }

  list.replaceChildren()

  if (filteredProjectPaths.length === 0) {
    const emptyState = document.createElement("div")
    emptyState.classList.add("settings-empty-state")
    emptyState.textContent = projectSearch
      ? "No projects match your search."
      : "No projects found. Add a scan folder above to find REAPER projects."
    list.appendChild(emptyState)
    return
  }

  for (const path of filteredProjectPaths) {
    const settings = settingsMap.get(path)

    const row = document.createElement("div")
    row.classList.add("settings-list-row", "project-settings-row")

    row.dataset.projectPath = path

    const name = document.createElement("span")
    name.textContent =
      path
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.rpp$/i, "") ?? path

    const visibleToggle = document.createElement("input")
    visibleToggle.type = "checkbox"
    visibleToggle.setAttribute("role", "switch")
    visibleToggle.classList.add("input", "project-visible")
    visibleToggle.checked = settings ? !settings.hidden : false
    // New/unconfigured projects are hidden by default
    const isVisible = settings ? !settings.hidden : false
    visibleToggle.checked = isVisible

    row.classList.toggle("project-hidden", !visibleToggle.checked)

    visibleToggle.addEventListener("change", () => {
      row.classList.toggle("project-hidden", !visibleToggle.checked)
    })

    const clickCheckbox = document.createElement("input")
    clickCheckbox.type = "checkbox"
    clickCheckbox.classList.add("input", "project-click")
    clickCheckbox.checked = settings?.recordedToClick ?? false

    row.append(name, visibleToggle, clickCheckbox)

    list.appendChild(row)
  }
}
