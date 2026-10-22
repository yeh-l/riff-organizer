import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "electron-vite"
import { build } from "esbuild"

function namWorkletPlugin(): {
  name: string
  load: (id: string) => Promise<string | undefined>
} {
  return {
    name: "bundle-nam-worklet",
    async load(id: string): Promise<string | undefined> {
      if (!id.endsWith("namWorklet.ts?worklet")) return undefined

      const sourcePath = id.slice(0, -"?worklet".length)
      const result = await build({
        entryPoints: [sourcePath],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        write: false
      })

      return `export default ${JSON.stringify(result.outputFiles[0].text)}`
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    optimizeDeps: {
      exclude: ["@opendaw/nam-wasm"]
    },
    plugins: [tailwindcss(), namWorkletPlugin()]
  }
})
