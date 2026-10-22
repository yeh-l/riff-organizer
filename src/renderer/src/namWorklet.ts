import { createNamModule, NamWasmModule } from "@opendaw/nam-wasm"

class WorkletURL {
  href: string
  origin: string
  protocol: string
  pathname: string

  constructor(url: string, base?: string) {
    let resolved = url

    if (base && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
      if (url.startsWith("/")) {
        const match = base.match(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/]+)/)

        if (match) {
          resolved = match[1] + url
        } else {
          resolved = url
        }
      } else {
        const baseDirectory = base.slice(0, base.lastIndexOf("/") + 1)
        resolved = baseDirectory + url
      }
    }

    this.href = resolved

    const protocolMatch = resolved.match(/^([a-zA-Z][a-zA-Z\d+\-.]*:)/)
    this.protocol = protocolMatch ? protocolMatch[1] : ""

    const originMatch = resolved.match(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/]+)/)

    this.origin = originMatch ? originMatch[1] : ""

    const pathnameStart = this.origin.length

    this.pathname = resolved.slice(pathnameStart)
  }
}

;(globalThis as unknown as { URL: typeof WorkletURL }).URL = WorkletURL

class NamProcessor extends AudioWorkletProcessor {
  private nam: NamWasmModule | null = null
  private instanceId = -1
  private ready = false

  constructor() {
    super()

    this.port.onmessage = (event) => {
      const data = event.data

      if (data.type === "init") {
        void this.initialize(data.wasmBinary)
        return
      }

      if (data.type === "loadModel") {
        void this.loadModel(data.modelJson, data.requestId)
        return
      }

      if (data.type === "reset") {
        if (this.nam && this.instanceId >= 0) {
          this.nam.reset(this.instanceId)
        }
      }
    }
  }

  private async initialize(wasmBinary: ArrayBuffer): Promise<void> {
    try {
      const module = await createNamModule({
        wasmBinary
      })

      this.nam = NamWasmModule.fromModule(module)

      this.nam.setSampleRate(sampleRate)
      this.nam.setMaxBufferSize(128)

      this.instanceId = this.nam.createInstance()
      this.ready = true

      this.port.postMessage({
        type: "ready"
      })
    } catch (error) {
      console.error("NAM worklet initialization failed:", error)

      this.port.postMessage({
        type: "error",
        error: String(error)
      })
    }
  }

  private loadModel(modelJson: string, requestId: number): void {
    if (!this.nam || this.instanceId < 0 || !this.ready) {
      console.error("NAM worklet: NAM not ready")

      this.port.postMessage({
        type: "modelLoaded",
        requestId,
        success: false,
        hasModel: false
      })

      return
    }

    try {
      const success = this.nam.loadModel(this.instanceId, modelJson)

      const hasModel = this.nam.hasModel(this.instanceId)
      const hasLoudness = this.nam.hasModelLoudness(this.instanceId)
      const loudness = hasLoudness ? this.nam.getModelLoudness(this.instanceId) : 0

      this.port.postMessage({
        type: "modelLoaded",
        requestId,
        success,
        hasModel,
        hasLoudness,
        loudness
      })
    } catch (error) {
      console.error("NAM worklet: model load failed:", error)

      this.port.postMessage({
        type: "modelLoaded",
        requestId,
        success: false,
        hasModel: false,
        error: String(error)
      })
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    const output = outputs[0]?.[0]

    if (!input || !output) {
      return true
    }

    if (!this.nam || this.instanceId < 0 || !this.ready) {
      output.set(input)
      return true
    }

    const hasModel = this.nam.hasModel(this.instanceId)

    if (!hasModel) {
      output.set(input)
      return true
    }

    try {
      this.nam.process(this.instanceId, input, output)
    } catch (error) {
      console.error("NAM process failed:", error)
      output.set(input)
    }

    return true
  }
}

registerProcessor("nam-processor", NamProcessor)
