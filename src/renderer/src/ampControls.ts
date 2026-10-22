import {
  isAmpEnabled,
  isCabEnabled,
  loadNamModel,
  setAmpEnabled,
  setCabEnabled,
  setOutputVolume
} from "./ampSim"

const ampButton = document.querySelector<HTMLButtonElement>("#amp-button")!
const cabButton = document.querySelector<HTMLButtonElement>("#cab-button")!
const chooseAmpButton = document.querySelector<HTMLButtonElement>("#choose-amp-button")!
const currentAmpDisplay = document.querySelector<HTMLDivElement>("#current-amp")!
const volumeSlider = document.querySelector<HTMLInputElement>("#volume-slider")!
const outputVolumeStorageKey = "riff-organizer.output-volume"

const storedOutputVolumeValue = localStorage.getItem(outputVolumeStorageKey)
const storedOutputVolume = storedOutputVolumeValue === null ? NaN : Number(storedOutputVolumeValue)
const initialOutputVolume = Number.isFinite(storedOutputVolume)
  ? Math.max(0, Math.min(100, storedOutputVolume))
  : 75

volumeSlider.value = initialOutputVolume.toString()
setOutputVolume(initialOutputVolume)

function updateAmpDisplay(filePath: string): void {
  currentAmpDisplay.textContent = filePath.split("\\").pop() ?? filePath
}

function updateAmpButton(): void {
  ampButton.classList.toggle("active", isAmpEnabled())
}

function updateCabButton(): void {
  cabButton.classList.toggle("active", isCabEnabled())
}

window.addEventListener("amp-model-loaded", (event) => {
  updateAmpDisplay((event as CustomEvent<string>).detail)
})

window.addEventListener("amp-state-changed", updateAmpButton)
window.addEventListener("cab-state-changed", updateCabButton)

updateAmpButton()
updateCabButton()

ampButton.addEventListener("click", () => {
  setAmpEnabled(!isAmpEnabled())
  updateAmpButton()
})

cabButton.addEventListener("click", () => {
  setCabEnabled(!isCabEnabled())
  updateCabButton()
})

chooseAmpButton.addEventListener("click", async () => {
  const filePath = await window.api.chooseAmpFile()

  if (!filePath) return

  const loaded = await loadNamModel(filePath)

  if (!loaded) return

  updateAmpDisplay(filePath)
  updateAmpButton()
})

volumeSlider.addEventListener("input", () => {
  const value = Number(volumeSlider.value)

  setOutputVolume(value)
  localStorage.setItem(outputVolumeStorageKey, value.toString())
})
