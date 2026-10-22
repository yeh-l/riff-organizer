import type { CustomGroup } from "../../shared/types"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function submitOnEnter(dialog: HTMLDialogElement, selector: string): void {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    if (event.target instanceof HTMLButtonElement) return

    event.preventDefault()
    dialog.querySelector<HTMLButtonElement>(selector)?.click()
  })
}

function createSvgIcon(attributes: Record<string, string>, content: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")

  for (const [name, value] of Object.entries(attributes)) {
    svg.setAttribute(name, value)
  }

  svg.innerHTML = content
  return svg
}

export function showConfirmDialog(
  title: string,
  message: string,
  confirmLabel = "Remove",
  confirmVariant = "destructive"
): Promise<boolean> {
  const dialog = document.createElement("dialog")
  dialog.className = "alert-dialog"

  dialog.innerHTML = `
    <div class="bg-background rounded-lg border p-6 shadow-lg">
      <header>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </header>

      <footer class="bg-background border-t-0">
        <button
          type="button"
          class="btn"
          data-variant="ghost"
          data-close
        >
          Cancel
        </button>

        <button
          type="button"
          class="btn"
          data-variant="${escapeHtml(confirmVariant)}"
          data-confirm
          autofocus
        >
          ${escapeHtml(confirmLabel)}
        </button>
      </footer>
    </div>
  `

  document.body.appendChild(dialog)

  return new Promise((resolve) => {
    const closeDialog = (confirmed: boolean): void => {
      dialog.close(confirmed ? "confirm" : "cancel")
    }

    dialog.addEventListener(
      "close",
      () => {
        const confirmed = dialog.returnValue === "confirm"

        dialog.remove()
        resolve(confirmed)
      },
      { once: true }
    )

    dialog.querySelector<HTMLButtonElement>("[data-confirm]")!.addEventListener("click", () => {
      closeDialog(true)
    })

    dialog.querySelector<HTMLButtonElement>("[data-close]")!.addEventListener("click", () => {
      closeDialog(false)
    })

    submitOnEnter(dialog, "[data-confirm]")
    dialog.showModal()
  })
}

let toastTimeout: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string, variant: "success" | "error" = "success"): void {
  let toast = document.querySelector<HTMLElement>("#app-toast")

  if (!toast) {
    toast = document.createElement("div")
    toast.id = "app-toast"
    toast.className =
      "alert fixed bottom-20 left-1/2 z-50 flex w-fit -translate-x-1/2 items-center gap-1 whitespace-nowrap px-2 py-1 text-xs opacity-0 pointer-events-none transition-opacity duration-200"
    toast.setAttribute("role", "status")
    toast.setAttribute("aria-hidden", "true")
    document.body.appendChild(toast)
  }

  toast.classList.remove(
    "text-emerald-100",
    "bg-emerald-950",
    "border-emerald-900",
    "text-red-100",
    "bg-red-950",
    "border-red-900"
  )

  if (variant === "error") {
    toast.classList.add("text-red-100", "bg-red-950", "border-red-900")
  } else {
    toast.classList.add("text-emerald-100", "bg-emerald-950", "border-emerald-900")
  }

  toast.textContent = message
  toast.classList.remove("opacity-0", "pointer-events-none")
  toast.setAttribute("aria-hidden", "false")

  if (toastTimeout) clearTimeout(toastTimeout)

  toastTimeout = setTimeout(() => {
    toast!.classList.add("opacity-0", "pointer-events-none")
    toast!.setAttribute("aria-hidden", "true")
  }, 2000)
}

export function showGroupAssignmentDialog(
  groups: CustomGroup[],
  selectedGroupIds: number[]
): Promise<number[] | null> {
  const dialog = document.createElement("dialog")
  dialog.className = "dialog"
  dialog.innerHTML = `
    <div class="bg-background rounded-lg border p-6 shadow-lg group-assignment-dialog">
      <button type="button" class="btn dialog-close-button" data-close aria-label="Close dialog">×</button>
      <header><h2>Add to riff group</h2></header>
      <section class="group-assignment-list"></section>
      <footer>
        <form method="dialog">
          <button type="submit" class="btn" data-variant="ghost">Cancel</button>
        </form>
        <button type="button" class="btn" data-save autofocus>Save</button>
      </footer>
    </div>
  `

  const list = dialog.querySelector<HTMLElement>(".group-assignment-list")!
  const checkboxes: HTMLInputElement[] = []

  for (const group of groups) {
    const label = document.createElement("label")
    label.className = "group-assignment-option"

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = selectedGroupIds.includes(group.id)
    checkbox.dataset.groupId = String(group.id)
    checkbox.classList.add("input")

    const name = document.createElement("span")
    name.textContent = group.name

    label.append(checkbox, name)
    list.appendChild(label)
    checkboxes.push(checkbox)
  }

  document.body.appendChild(dialog)

  return new Promise((resolve) => {
    let result: number[] | null = null

    dialog.addEventListener(
      "close",
      () => {
        dialog.remove()
        resolve(result)
      },
      { once: true }
    )

    dialog.querySelector<HTMLButtonElement>("[data-save]")!.addEventListener("click", () => {
      result = checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => Number(checkbox.dataset.groupId))
      dialog.close("save")
    })
    dialog.querySelector<HTMLButtonElement>("[data-close]")!.addEventListener("click", () => {
      dialog.close("cancel")
    })

    submitOnEnter(dialog, "[data-confirm]")
    dialog.showModal()
  })
}

export function showTextInputDialog(title: string, initialValue = ""): Promise<string | null> {
  const dialog = document.createElement("dialog")
  dialog.className = "dialog"
  dialog.innerHTML = `
    <div class="bg-background rounded-lg border p-6 shadow-lg">
      <button type="button" class="btn dialog-close-button" data-close aria-label="Close dialog">×</button>
      <header><h2>${escapeHtml(title)}</h2></header>
      <input class="input" data-group-name maxlength="40" />
      <footer>
        <form method="dialog">
          <button type="submit" class="btn" data-variant="ghost">Cancel</button>
        </form>
        <button type="button" class="btn" data-save>Save</button>
      </footer>
    </div>
  `

  document.body.appendChild(dialog)

  return new Promise((resolve) => {
    let result: string | null = null

    dialog.addEventListener(
      "close",
      () => {
        dialog.remove()
        resolve(result)
      },
      { once: true }
    )

    const input = dialog.querySelector<HTMLInputElement>("[data-group-name]")!
    const saveButton = dialog.querySelector<HTMLButtonElement>("[data-save]")!

    input.value = initialValue

    saveButton.addEventListener("click", () => {
      const value = input.value.trim()
      if (!value) return

      result = value
      dialog.close("save")
    })

    dialog.querySelector<HTMLButtonElement>("[data-close]")!.addEventListener("click", () => {
      dialog.close("cancel")
    })

    dialog.showModal()
    input.focus()
    input.select()

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return

      event.preventDefault()
      saveButton.click()
    })
  })
}

export function initializeIcons(): void {
  const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button")
  const addGroupButton = document.querySelector<HTMLButtonElement>("#add-group-button")
  const ampButton = document.querySelector<HTMLButtonElement>("#amp-button")
  const cabButton = document.querySelector<HTMLButtonElement>("#cab-button")
  const volumeControl = document.querySelector<HTMLDivElement>(".volume-control")

  settingsButton?.appendChild(
    createSvgIcon(
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24"
      },
      `<path d="M0 0h24v24H0z" fill="none" />
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2">
        <path d="M3 5h4m14 0H11m-8 7h12m6 0h-2M3 19h2m16 0H9" />
        <circle cx="9" cy="5" r="2" />
        <circle cx="17" cy="12" r="2" />
        <circle cx="7" cy="19" r="2" />
      </g>`
    )
  )

  addGroupButton?.replaceChildren(
    createSvgIcon(
      {
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "aria-hidden": "true"
      },
      `<path d="M12 5v14M5 12h14" />`
    )
  )

  ampButton?.appendChild(
    createSvgIcon(
      { class: "amp-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      `<path d="M7 5c1.5-2 8.5-2 10 0" />
      <rect x="2" y="5" width="20" height="13" rx="1.5" />
      <rect x="4" y="7" width="16" height="9" rx="0.5" />
      <path d="M9 10.5h6" stroke-linecap="round" />
      <rect x="5" y="13" width="14" height="2.5" rx="0.75" style="fill:#22c55e;stroke:none" />
      <circle cx="8" cy="14.25" r="0.9" style="fill:var(--background);stroke:none" />
      <circle cx="12" cy="14.25" r="0.9" style="fill:var(--background);stroke:none" />
      <circle cx="16" cy="14.25" r="0.9" style="fill:var(--background);stroke:none" />
      <path d="M5 18v2M19 18v2" />`
    )
  )

  cabButton?.appendChild(
    createSvgIcon(
      { class: "cab-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M5 6h14M5 9h14M5 12h14M5 15h14M5 18h14" style="opacity:0.7" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />`
    )
  )

  volumeControl?.prepend(
    createSvgIcon(
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "1.5em",
        height: "1.5em",
        viewBox: "0 0 24 24"
      },
      `<path d="M0 0h24v24H0z" fill="none" />
      <path
        fill="currentColor"
          d="M14.61 4.846a1 1 0 0 0-1.633-.645L7.958 8.384a.5.5 0 0 1-.32.116H3.75c-.69 0-1.25.56-1.25 1.25v4.5c0 .69.56 1.25 1.25 1.25h3.888a.5.5 0 0 1 .32.116l5.02 4.182a1 1 0 0 0 1.632-.644l.095-.766c.53-4.242.53-8.534 0-12.776zm5.298 1.1a.75.75 0 0 1 .948.476c.58 1.755.894 3.63.894 5.578a17.8 17.8 0 0 1-.894 5.578a.75 0 1 1-1.424-.471c.53-1.605.818-3.322.818-5.107s-.288-3.502-.818-5.107a.75.75 0 0 1 .476-.947m-1.876 2.002a.75.75 0 0 0-1.408.517c.405 1.1.626 2.291.626 3.535a10.3 10.3 0 0 1-.626 3.535a.75.75 0 0 0 1.408.517A11.7 11.7 0 0 0 18.75 12c0-1.423-.253-2.788-.718-4.052"
      />`
    )
  )
}

export function createSelect(
  value: string,
  options: { value: string; label: string }[]
): HTMLDivElement {
  const select = document.createElement("div")
  select.classList.add("select")

  const current = options.find((option) => option.value === value) ?? options[0]

  select.innerHTML = `
  <button
    type="button"
    class="w-[160px]"
    aria-haspopup="listbox"
    aria-expanded="false"
  >
    <span class="truncate">${current.label}</span>

    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-muted-foreground opacity-50 shrink-0"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>

  <div data-popover aria-hidden="true">
    <div role="listbox">
      ${options
        .map((option) => `<div role="option" data-value="${option.value}">${option.label}</div>`)
        .join("")}
    </div>
  </div>

  <input type="hidden" value="${value}" />
`

  return select
}
