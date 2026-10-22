export interface VirtualListOptions<T> {
  container: HTMLElement
  items: T[]
  rowHeight: number
  overscan: number
  createRow: (item: T) => HTMLElement
}

export interface VirtualList {
  destroy(): void
}

export function createVirtualList<T>(options: VirtualListOptions<T>): VirtualList {
  const { container, items, rowHeight, overscan, createRow } = options

  container.innerHTML = ""

  if (!container.hasAttribute("tabindex")) {
    container.tabIndex = 0
  }

  const viewport = document.createElement("div")
  viewport.classList.add("virtual-list-viewport")
  viewport.style.position = "relative"
  viewport.style.height = `${items.length * rowHeight}px`

  container.appendChild(viewport)

  let rows: HTMLElement[] = []
  let firstRenderedIndex = -1
  let lastRenderedIndex = -1

  function renderRows(force = false): void {
    const scrollTop = container.scrollTop
    const viewportHeight = container.clientHeight

    const visibleFirstIndex = Math.max(0, Math.floor(scrollTop / rowHeight))

    const visibleLastIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + viewportHeight) / rowHeight)
    )

    const firstIndex = Math.max(0, visibleFirstIndex - overscan)

    const lastIndex = Math.min(items.length - 1, visibleLastIndex + overscan)

    if (
      !force &&
      visibleFirstIndex >= firstRenderedIndex &&
      visibleLastIndex <= lastRenderedIndex
    ) {
      return
    }

    const activeElement = document.activeElement

    const focusWasInRow =
      activeElement instanceof HTMLElement && rows.some((row) => row.contains(activeElement))

    if (focusWasInRow) {
      container.focus({ preventScroll: true })
    }

    for (const row of rows) {
      row.remove()
    }

    rows = []

    firstRenderedIndex = firstIndex
    lastRenderedIndex = lastIndex

    for (let index = firstIndex; index <= lastIndex; index++) {
      const item = items[index]

      if (!item) continue

      const row = createRow(item)

      row.style.position = "absolute"
      row.style.top = `${index * rowHeight}px`
      row.style.left = "0"
      row.style.right = "0"
      row.style.height = `${rowHeight}px`

      viewport.appendChild(row)
      rows.push(row)
    }
  }

  let framePending = false

  function handleScroll(): void {
    if (framePending) return

    framePending = true

    requestAnimationFrame(() => {
      framePending = false
      renderRows()
    })
  }

  container.addEventListener("scroll", handleScroll)

  renderRows(true)

  return {
    destroy(): void {
      container.removeEventListener("scroll", handleScroll)
      container.innerHTML = ""
      rows = []
    }
  }
}
