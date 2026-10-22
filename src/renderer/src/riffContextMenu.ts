import type { CustomGroup, Item, Project } from "../../shared/types"
import { getRiffGroups, updateRiffGroups } from "./metadata"
import { showConfirmDialog, showGroupAssignmentDialog, showToast } from "./ui"
import { formatTime } from "./utils"

type DropdownMenuElement = HTMLDivElement & {
  open?: () => void
}

type BasecoatRuntime = {
  init: (componentName: string) => void
}

type RiffContextMenuCallbacks = {
  getCustomGroups: () => CustomGroup[]
  onGroupsChanged: () => void
}

let activeRiffContextMenu: HTMLDivElement | null = null
let activeRiffContextRow: HTMLLIElement | null = null

function closeRiffContextMenu(): void {
  activeRiffContextMenu?.remove()
  activeRiffContextRow?.classList.remove("context-menu-open")
  activeRiffContextMenu = null
  activeRiffContextRow = null
}

export function attachRiffContextMenu(
  row: HTMLLIElement,
  item: Item,
  project: Project,
  callbacks: RiffContextMenuCallbacks
): void {
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault()
    closeRiffContextMenu()
    row.classList.add("context-menu-open")

    const menu = document.createElement("div")
    menu.className = "dropdown-menu riff-context-menu"
    menu.style.left = `${event.clientX}px`
    menu.style.top = `${event.clientY}px`

    const trigger = document.createElement("button")
    trigger.type = "button"
    trigger.hidden = true
    trigger.setAttribute("aria-haspopup", "menu")
    trigger.setAttribute("aria-controls", "riff-context-menu-items")
    trigger.className = "riff-context-menu-trigger"

    const popover = document.createElement("div")
    popover.dataset.popover = ""
    popover.dataset.side = "bottom"
    popover.dataset.align = "start"
    popover.setAttribute("aria-hidden", "true")

    const menuItems = document.createElement("div")
    menuItems.id = "riff-context-menu-items"
    menuItems.setAttribute("role", "menu")

    const openInReaperItem = document.createElement("div")
    openInReaperItem.setAttribute("role", "menuitem")
    openInReaperItem.textContent = "Open in REAPER"

    const addToGroupItem = document.createElement("div")
    addToGroupItem.setAttribute("role", "menuitem")
    addToGroupItem.textContent = "Assign to riff group"
    const customGroups = callbacks.getCustomGroups().filter((group) => !group.isSystem)
    if (customGroups.length === 0) addToGroupItem.setAttribute("aria-disabled", "true")

    const revealItem = document.createElement("div")
    revealItem.setAttribute("role", "menuitem")
    revealItem.textContent = "View in file explorer"
    if (item.filePath === null) revealItem.setAttribute("aria-disabled", "true")

    menuItems.append(openInReaperItem, revealItem, addToGroupItem)
    popover.append(menuItems)
    menu.append(trigger, popover)
    document.body.append(menu)
    activeRiffContextMenu = menu
    activeRiffContextRow = row

    const basecoat = (window as Window & { basecoat?: BasecoatRuntime }).basecoat
    basecoat?.init("dropdown-menu")

    const dropdown = menu as DropdownMenuElement
    requestAnimationFrame(() => {
      if (activeRiffContextMenu !== menu) return

      void popover.offsetWidth
      requestAnimationFrame(() => {
        if (activeRiffContextMenu === menu) dropdown.open?.()
      })
    })

    const removeMenu = (): void => {
      if (activeRiffContextMenu === menu) closeRiffContextMenu()
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true)
      document.removeEventListener("keydown", handleDocumentKeydown)
    }

    const handleDocumentPointerDown = (pointerEvent: PointerEvent): void => {
      if (!menu.contains(pointerEvent.target as Node)) removeMenu()
    }

    const handleDocumentKeydown = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key === "Escape") removeMenu()
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true)
    document.addEventListener("keydown", handleDocumentKeydown)

    openInReaperItem.addEventListener("click", async () => {
      removeMenu()

      const confirmed = await showConfirmDialog(
        "Open project in REAPER?",
        `Open "${project.rppPath
          .split(/[\\/]/)
          .pop()}"? Riff is located at ${formatTime(item.position ?? 0)}.`,
        "Open",
        "outline"
      )

      if (confirmed) await window.api.openInReaper(project.rppPath)
    })

    addToGroupItem.addEventListener("click", async () => {
      removeMenu()

      if (item.guid === null || customGroups.length === 0) return

      const currentGroupIds = getRiffGroups(item, project)
      const customGroupIds = new Set(customGroups.map((group) => group.id))
      const groupIds = await showGroupAssignmentDialog(
        customGroups,
        currentGroupIds.filter((groupId) => customGroupIds.has(groupId))
      )

      if (groupIds === null) return

      const systemGroupIds = currentGroupIds.filter((groupId) => !customGroupIds.has(groupId))

      const updatedGroupIds = [...systemGroupIds, ...groupIds]
      await window.api.setRiffGroups(project.rppPath, item.guid, updatedGroupIds)

      updateRiffGroups(`${project.rppPath}:${item.guid}`, updatedGroupIds)
      showToast("Riff group updated.")
      callbacks.onGroupsChanged()
    })

    revealItem.addEventListener("click", async () => {
      removeMenu()
      if (item.filePath !== null) await window.api.revealInFileExplorer(item.filePath)
    })
  })
}
