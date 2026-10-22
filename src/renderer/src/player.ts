import type { Item } from "../../shared/types"
import { formatTime } from "./utils"
import { loadAudioBuffer, playRiff, stopRiff, getAudioContext, normalizeInput } from "./ampSim"

const playButton = document.querySelector<HTMLButtonElement>("#player-play-button")!
const progressDisplay = document.querySelector<HTMLInputElement>("#progress")!
const currentTimeDisplay = document.querySelector<HTMLSpanElement>("#current-time")!
const durationDisplay = document.querySelector<HTMLSpanElement>("#duration")!

let currentItem: Item | null = null
let currentBuffer: AudioBuffer | null = null

let isSeeking = false
let wasPlayingBeforeSeek = false

let playbackPosition = 0
let playbackStartTime = 0
let playing = false

export async function loadRiff(item: Item): Promise<void> {
  if (isCurrentRiff(item)) {
    if (playing) {
      pausePlayback()
    } else {
      await startPlayback()
    }

    return
  }

  currentItem = item

  stopPlayback()

  const context = getAudioContext()

  if (context && context.state === "suspended") {
    await context.resume()
  }

  currentBuffer = await loadAudioBuffer(item.filePath!)

  if (!currentBuffer) {
    console.error("Failed to load riff:", item.filePath)
    return
  }

  normalizeInput(currentBuffer)

  playbackPosition = 0

  progressDisplay.max = (item.length ?? 0).toString()
  progressDisplay.value = "0"

  currentTimeDisplay.textContent = "0:00"
  durationDisplay.textContent = formatTime(item.length ?? 0)

  await startPlayback()
}

export function isPlaying(): boolean {
  return playing
}

export function isCurrentRiff(item: Item): boolean {
  return currentItem?.guid === item.guid
}

function notifyPlaybackChange(): void {
  window.dispatchEvent(
    new CustomEvent("playback-change", {
      detail: {
        item: currentItem,
        playing
      }
    })
  )
}

async function startPlayback(): Promise<void> {
  if (!currentItem || !currentBuffer || playing) return

  const context = getAudioContext()

  if (!context) return

  if (context.state === "suspended") {
    await context.resume()
  }

  const riffLength = currentItem.length ?? 0
  let sourceOffset = currentItem.sourceOffset ?? 0

  if (sourceOffset < 0 || currentBuffer.duration - sourceOffset < (currentItem.length ?? 0)) {
    sourceOffset = 0
  }

  if (playbackPosition >= riffLength) {
    playbackPosition = 0
  }

  const remaining = riffLength - playbackPosition

  if (remaining <= 0) return

  playbackStartTime = context.currentTime - playbackPosition
  playing = true

  playRiff(currentBuffer, sourceOffset + playbackPosition, remaining)

  playButton.textContent = "⏸︎"
  notifyPlaybackChange()

  requestAnimationFrame(updateProgressDisplay)
}

function pausePlayback(): void {
  if (!playing) return

  const context = getAudioContext()

  if (context) {
    playbackPosition = context.currentTime - playbackStartTime
  }

  stopRiff()

  playing = false
  playButton.textContent = "\u25B6\uFE0E"

  notifyPlaybackChange()
}

function stopPlayback(): void {
  stopRiff()

  playing = false
  playbackPosition = 0

  playButton.textContent = "\u25B6\uFE0E"
}

function resetPlayback(): void {
  stopRiff()

  playing = false
  playbackPosition = 0

  progressDisplay.value = "0"
  progressDisplay.dispatchEvent(new Event("input", { bubbles: true }))

  currentTimeDisplay.textContent = "0:00"
  playButton.textContent = "\u25B6\uFE0E"

  notifyPlaybackChange()
}

function updateProgressDisplay(): void {
  if (!currentItem || isSeeking || !playing) return

  const context = getAudioContext()

  if (!context) return

  playbackPosition = context.currentTime - playbackStartTime

  const riffLength = currentItem.length ?? 0

  if (playbackPosition >= riffLength) {
    resetPlayback()
    return
  }

  progressDisplay.value = playbackPosition.toString()
  progressDisplay.dispatchEvent(new Event("input", { bubbles: true }))

  currentTimeDisplay.textContent = formatTime(playbackPosition)

  requestAnimationFrame(updateProgressDisplay)
}

playButton.addEventListener("click", () => {
  if (!currentItem || !currentBuffer) return

  if (playing) {
    pausePlayback()
  } else {
    startPlayback()
  }
})

progressDisplay.addEventListener("input", () => {
  currentTimeDisplay.textContent = formatTime(Number(progressDisplay.value))
})

progressDisplay.addEventListener("pointerdown", () => {
  if (!currentItem) return

  isSeeking = true
  wasPlayingBeforeSeek = playing

  if (playing) {
    pausePlayback()
  }
})

progressDisplay.addEventListener("pointerup", () => {
  if (!currentItem) return

  playbackPosition = Number(progressDisplay.value)

  isSeeking = false

  if (wasPlayingBeforeSeek) {
    startPlayback()
  }
})

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return

  const target = event.target as HTMLElement

  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    return
  }

  if (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range") {
    return
  }

  if (!currentItem || !currentBuffer) return

  event.preventDefault()

  if (playing) {
    pausePlayback()
  } else {
    startPlayback()
  }
})
