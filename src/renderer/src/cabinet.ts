import { initAmpSim, loadCabIR } from "./ampSim"

const cabStorageKey = "riff-organizer.cab"

const chooseCabButton = document.querySelector<HTMLButtonElement>("#choose-cab-button")!
const currentCabDisplay = document.querySelector<HTMLDivElement>("#current-cab")!

export async function loadDefaultCab(): Promise<void> {
  await initAmpSim()

  const activeCabPath = localStorage.getItem(cabStorageKey)

  currentCabDisplay.textContent = activeCabPath?.split(/[\\/]/).pop() ?? "Inactive"
}

chooseCabButton.addEventListener("click", async () => {
  const filePath = await window.api.chooseCabFile()

  if (!filePath) return

  try {
    const loaded = await loadCabIR(filePath)

    if (!loaded) {
      localStorage.removeItem(cabStorageKey)
      currentCabDisplay.textContent = "Unloaded"
      return
    }

    currentCabDisplay.textContent = filePath.split(/[\\/]/).pop() ?? filePath
  } catch (error) {
    console.error("Failed to load cab IR:", error)
    currentCabDisplay.textContent = "Inactive"
  }
})
