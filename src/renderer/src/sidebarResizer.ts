const app = document.querySelector<HTMLDivElement>("#app")!
const resizer = document.querySelector<HTMLDivElement>("#sidebar-resizer")!

const minWidth = 150
const maxWidth = 270
const storageKey = "riff-organizer.sidebar-width"

function setSidebarWidth(width: number): void {
  const clampedWidth = Math.max(minWidth, Math.min(maxWidth, width))

  app.style.setProperty("--sidebar-width", `${clampedWidth}px`)
  resizer.setAttribute("aria-valuenow", String(clampedWidth))
  localStorage.setItem(storageKey, String(clampedWidth))
}

const storedWidth = Number(localStorage.getItem(storageKey))
setSidebarWidth(Number.isFinite(storedWidth) ? storedWidth : 240)

let pointerId: number | null = null

resizer.addEventListener("pointerdown", (event) => {
  pointerId = event.pointerId
  resizer.setPointerCapture(event.pointerId)
  app.classList.add("sidebar-resizing")
  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
})

resizer.addEventListener("pointermove", (event) => {
  if (pointerId !== event.pointerId) return

  const appRect = app.getBoundingClientRect()
  setSidebarWidth(event.clientX - appRect.left)
})

function stopResizing(): void {
  if (pointerId === null) return

  pointerId = null
  app.classList.remove("sidebar-resizing")
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

resizer.addEventListener("pointerup", stopResizing)
resizer.addEventListener("pointercancel", stopResizing)

resizer.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault()
    const currentWidth = parseInt(getComputedStyle(app).getPropertyValue("--sidebar-width"), 10)
    setSidebarWidth(currentWidth + (event.key === "ArrowRight" ? 10 : -10))
  }
})
