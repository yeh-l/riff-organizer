import { loadLibrary } from "../screens/library"
import "basecoat-css/all"
import { createSettingsDialog, openSettings } from "../screens/settings"
import { initAmpSim } from "./ampSim"
import "./ampControls"
import { loadDefaultCab } from "./cabinet"
import "./sidebarResizer"
import { initializeIcons } from "./ui"

const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button")!

initializeIcons()

async function init(): Promise<void> {
  document.body.appendChild(createSettingsDialog())

  await Promise.all([loadLibrary(), initAmpSim()])
  await loadDefaultCab()
}

settingsButton.addEventListener("click", () => {
  openSettings()
})

void init()
