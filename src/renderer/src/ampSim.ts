import namWorkletSource from "./namWorklet.ts?worklet"
import namWasmUrl from "../public/nam.wasm?url"
import decode from "@audio/decode"

let audioContext: AudioContext | null = null
let namNode: AudioWorkletNode | null = null

let ampInitPromise: Promise<void> | null = null
let namReadyPromise: Promise<void> | null = null

let normalizationGain = 1

let inputGainNode: GainNode | null = null
let ampBypassGainCompensation: GainNode | null = null
let namOutputGain: GainNode | null = null

let cab: ConvolverNode | null = null
let cabGain: GainNode | null = null

let outputGain: GainNode | null = null
let limiter: DynamicsCompressorNode | null = null
let outputVolume = 75

let currentSource: AudioBufferSourceNode | null = null

let ampEnabled = false
let cabEnabled = false

let ampModelLoaded = false
let cabLoaded = false

let nextModelRequestId = 0
const modelLoadTimeoutMs = 15000

const ampModelStorageKey = "riff-organizer.amp-model"
const cabStorageKey = "riff-organizer.cab"

export function initAmpSim(): Promise<void> {
  if (ampInitPromise) {
    return ampInitPromise
  }

  ampInitPromise = (async () => {
    audioContext = new AudioContext()

    createAudioGraph(audioContext)

    await initializeNamNode(audioContext)

    const defaults = await window.api.getDefaultModels()

    const storedAmpPath = localStorage.getItem(ampModelStorageKey)

    if (storedAmpPath) {
      if (!(await loadNamModel(storedAmpPath))) {
        localStorage.removeItem(ampModelStorageKey)
        setAmpInactive()
      }
    } else if (defaults.highGain) {
      if (!(await loadNamModel(defaults.highGain))) {
        setAmpInactive()
      }
    } else {
      setAmpInactive()
    }

    const storedCabPath = localStorage.getItem(cabStorageKey)

    if (storedCabPath) {
      if (!(await loadCabIR(storedCabPath))) {
        localStorage.removeItem(cabStorageKey)
        setCabInactive()
      }
    } else if (defaults.cab) {
      if (!(await loadCabIR(defaults.cab))) {
        setCabInactive()
      }
    } else {
      setCabInactive()
    }

    setOutputVolume(outputVolume)
    updateRouting()

    async function initializeNamNode(context: AudioContext): Promise<void> {
      const workletBlob = new Blob([namWorkletSource], {
        type: "text/javascript"
      })

      const workletUrl = URL.createObjectURL(workletBlob)

      try {
        await context.audioWorklet.addModule(workletUrl)
      } finally {
        URL.revokeObjectURL(workletUrl)
      }

      namNode = new AudioWorkletNode(context, "nam-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      })

      namReadyPromise = new Promise<void>((resolve, reject) => {
        const handleMessage = (event: MessageEvent): void => {
          if (event.data.type === "ready") {
            namNode!.port.removeEventListener("message", handleMessage)
            resolve()
            return
          }

          if (event.data.type === "error") {
            namNode!.port.removeEventListener("message", handleMessage)
            reject(new Error(event.data.error))
          }
        }

        namNode!.port.addEventListener("message", handleMessage)
        namNode!.port.start()
      })

      const wasmResponse = await fetch(namWasmUrl)

      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch NAM WASM: ${wasmResponse.status}`)
      }

      const wasmBinary = await wasmResponse.arrayBuffer()

      namNode.port.postMessage(
        {
          type: "init",
          wasmBinary
        },
        [wasmBinary]
      )

      await namReadyPromise
    }
  })()

  return ampInitPromise
}

function setAmpInactive(): void {
  const routingChanged = ampEnabled

  ampModelLoaded = false
  ampEnabled = false

  window.dispatchEvent(
    new CustomEvent("amp-state-changed", {
      detail: { enabled: false }
    })
  )

  if (routingChanged) {
    updateRouting()
  }
}

function setCabInactive(): void {
  const routingChanged = cabEnabled

  cabLoaded = false
  cabEnabled = false

  window.dispatchEvent(
    new CustomEvent("cab-state-changed", {
      detail: { enabled: false }
    })
  )

  if (routingChanged) {
    updateRouting()
  }
}

function createAudioGraph(context: AudioContext): void {
  inputGainNode = context.createGain()

  ampBypassGainCompensation = context.createGain()
  ampBypassGainCompensation.gain.value = 1

  namOutputGain = context.createGain()

  cab = context.createConvolver()
  cab.normalize = false

  cabGain = context.createGain()
  cabGain.gain.value = 1

  outputGain = context.createGain()

  limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05

  outputGain.connect(limiter)
  limiter.connect(context.destination)
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

function setGainSmoothly(node: GainNode, gain: number, timeConstant = 0.02): void {
  if (!audioContext) {
    node.gain.value = gain
    return
  }

  const now = audioContext.currentTime

  node.gain.cancelScheduledValues(now)
  node.gain.setTargetAtTime(gain, now, timeConstant)
}

function calculateRms(buffer: AudioBuffer, startSample: number, endSample: number): number {
  let sum = 0
  let count = 0

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)

    for (let i = startSample; i < endSample; i++) {
      const sample = data[i]

      sum += sample * sample
      count++
    }
  }

  if (count === 0) {
    return 0
  }

  return Math.sqrt(sum / count)
}

function createCalibrationSignal(context: BaseAudioContext): AudioBuffer {
  const duration = 3
  const length = Math.floor(context.sampleRate * duration)

  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)

  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1

    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898

    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362

    b6 = white * 0.115926

    data[i] = pink * 0.08
  }

  return buffer
}

async function calibrateCab(ir: AudioBuffer): Promise<number> {
  if (!audioContext) {
    return 1
  }

  const duration = 3
  const sampleRate = audioContext.sampleRate

  const offline = new OfflineAudioContext(2, Math.floor(duration * sampleRate), sampleRate)

  const source = offline.createBufferSource()
  const reference = createCalibrationSignal(offline)

  source.buffer = reference

  const convolver = offline.createConvolver()
  convolver.normalize = false
  convolver.buffer = ir

  source.connect(convolver)
  convolver.connect(offline.destination)

  source.start()

  const rendered = await offline.startRendering()

  const startSample = Math.floor(sampleRate * 0.5)
  const endSample = Math.floor(sampleRate * 2.5)

  const inputRms = calculateRms(reference, startSample, endSample)
  const outputRms = calculateRms(rendered, startSample, endSample)

  if (inputRms <= 0 || outputRms <= 0) {
    return 1
  }

  return inputRms / outputRms
}

export async function loadNamModel(filePath: string): Promise<boolean> {
  if (!namNode || !namReadyPromise) {
    setAmpInactive()
    return false
  }

  try {
    await namReadyPromise

    const buffer = await window.api.loadAudio(filePath)

    if (!buffer) {
      console.error("Failed to load NAM model:", filePath)
      setAmpInactive()
      return false
    }

    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    const modelJson = new TextDecoder().decode(bytes)

    const requestId = ++nextModelRequestId

    return await new Promise<boolean>((resolve) => {
      let settled = false
      let timeout: ReturnType<typeof setTimeout>
      let handleMessage = (_event: MessageEvent): void => undefined

      const finish = (success: boolean): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        namNode!.port.removeEventListener("message", handleMessage)
        resolve(success)
      }

      handleMessage = (event: MessageEvent): void => {
        if (
          event.data.type !== "modelLoaded" ||
          event.data.requestId !== requestId
        ) {
          return
        }

        if (!event.data.success) {
          setAmpInactive()
          finish(false)
          return
        }

        if (event.data.hasLoudness && typeof event.data.loudness === "number") {
          const targetLoudness = -18
          const gainDb = targetLoudness - event.data.loudness

          setGainSmoothly(namOutputGain!, dbToGain(gainDb))
        } else {
          setGainSmoothly(namOutputGain!, 1)
        }

        localStorage.setItem(ampModelStorageKey, filePath)

        window.dispatchEvent(
          new CustomEvent("amp-model-loaded", {
            detail: filePath
          })
        )

        const routingChanged = !ampEnabled

        ampModelLoaded = true
        ampEnabled = true

        window.dispatchEvent(
          new CustomEvent("amp-state-changed", {
            detail: { enabled: true }
          })
        )

        if (routingChanged) {
          updateRouting()
        }

        finish(true)
      }

      timeout = setTimeout(() => {
        console.error(`Timed out loading NAM model after ${modelLoadTimeoutMs}ms:`, filePath)
        setAmpInactive()
        finish(false)
      }, modelLoadTimeoutMs)

      namNode!.port.addEventListener("message", handleMessage)

      namNode!.port.postMessage({
        type: "loadModel",
        requestId,
        modelJson
      })
    })
  } catch (error) {
    console.error("Failed to load NAM model:", error)
    setAmpInactive()
    return false
  }
}

export function normalizeInput(buffer: AudioBuffer, targetDb = -12): void {
  let peak = 0

  const data = buffer.getChannelData(0)

  for (let i = 0; i < data.length; i++) {
    peak = Math.max(peak, Math.abs(data[i]))
  }

  if (peak === 0) {
    normalizationGain = 1
    return
  }

  const targetPeak = dbToGain(targetDb)

  normalizationGain = targetPeak / peak
}

export async function loadCabIR(filePath: string): Promise<boolean> {
  if (!cab || !cabGain) {
    setCabInactive()
    return false
  }

  try {
    const ir = await decodeAudioFile(filePath, "IR")

    if (!ir) {
      setCabInactive()
      return false
    }

    cab.buffer = ir

    const calibrationGain = await calibrateCab(ir)
    setGainSmoothly(cabGain, calibrationGain)

    localStorage.setItem(cabStorageKey, filePath)

    const routingChanged = !cabEnabled

    cabLoaded = true
    cabEnabled = true

    window.dispatchEvent(
      new CustomEvent("cab-state-changed", {
        detail: { enabled: true }
      })
    )

    if (routingChanged) {
      updateRouting()
    }

    return true
  } catch (error) {
    console.error("Failed to load cab IR:", error)
    setCabInactive()
    return false
  }
}

export async function loadAudioBuffer(filePath: string): Promise<AudioBuffer | null> {
  await initAmpSim()

  return decodeAudioFile(filePath, "audio")
}

async function decodeAudioFile(filePath: string, fileType: string): Promise<AudioBuffer | null> {
  if (!audioContext) {
    return null
  }

  const buffer = await window.api.loadAudio(filePath)

  if (!buffer) {
    console.error(`Failed to load ${fileType}:`, filePath)
    return null
  }

  const bytes = new Uint8Array(buffer)

  try {
    return await audioContext.decodeAudioData(bytes.slice().buffer)
  } catch {
    // Fall back to the multi-format decoder.
  }

  try {
    const decoded = await decode(bytes)

    if (decoded.channelData.length === 0 || decoded.channelData[0].length === 0) {
      throw new Error("Decoded audio contains no samples")
    }

    const audioBuffer = audioContext.createBuffer(
      decoded.channelData.length,
      decoded.channelData[0].length,
      decoded.sampleRate
    )

    decoded.channelData.forEach((channelData, index) => {
      audioBuffer.copyToChannel(new Float32Array(channelData), index)
    })

    return audioBuffer
  } catch (error) {
    console.error(`Failed to decode ${fileType}:`, filePath, error)
    return null
  }
}

function updateRouting(): void {
  if (!inputGainNode || !outputGain || !ampBypassGainCompensation || !namOutputGain || !cabGain) {
    return
  }

  inputGainNode.disconnect()
  namNode?.disconnect()
  namOutputGain.disconnect()
  ampBypassGainCompensation.disconnect()
  cab?.disconnect()
  cabGain.disconnect()

  if (ampEnabled && ampModelLoaded && namNode) {
    inputGainNode.connect(namNode)
  } else {
    inputGainNode.connect(ampBypassGainCompensation)
  }

  const source = ampEnabled && ampModelLoaded ? namOutputGain : ampBypassGainCompensation

  if (ampEnabled && ampModelLoaded && namNode) {
    namNode.connect(namOutputGain)
  }

  if (cabEnabled && cabLoaded && cab) {
    source.connect(cab)
    cab.connect(cabGain)
    cabGain.connect(outputGain)
  } else {
    source.connect(outputGain)
  }
}

export function playRiff(buffer: AudioBuffer, offset: number, duration: number): void {
  if (!audioContext || !inputGainNode) {
    return
  }

  stopRiff()

  currentSource = audioContext.createBufferSource()
  currentSource.buffer = buffer

  inputGainNode.gain.value = normalizationGain

  currentSource.connect(inputGainNode)

  currentSource.start(0, offset, duration)
}

export function stopRiff(): void {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // Already stopped.
    }

    currentSource.disconnect()
    currentSource = null
  }
}

export function resumeAmpSim(): void {
  if (!audioContext) {
    void initAmpSim()
    return
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }
}

export function getAudioContext(): AudioContext | null {
  return audioContext
}

export function setAmpEnabled(enabled: boolean): void {
  const nextEnabled = enabled && ampModelLoaded

  if (ampEnabled === nextEnabled) {
    return
  }

  ampEnabled = nextEnabled

  window.dispatchEvent(
    new CustomEvent("amp-state-changed", {
      detail: { enabled: ampEnabled }
    })
  )

  updateRouting()
}

export function setCabEnabled(enabled: boolean): void {
  const nextEnabled = enabled && cabLoaded

  if (cabEnabled === nextEnabled) {
    return
  }

  cabEnabled = nextEnabled

  window.dispatchEvent(
    new CustomEvent("cab-state-changed", {
      detail: { enabled: cabEnabled }
    })
  )

  updateRouting()
}

export function isAmpEnabled(): boolean {
  return ampEnabled
}

export function isCabEnabled(): boolean {
  return cabEnabled
}

export function setOutputVolume(value: number): void {
  outputVolume = Math.max(0, Math.min(100, value))

  if (!outputGain) {
    return
  }

  if (outputVolume <= 0) {
    outputGain.gain.value = 0
    return
  }

  const normalized = outputVolume / 100
  const db = -50 + Math.pow(normalized, 0.3) * 50

  outputGain.gain.value = dbToGain(db)
}
