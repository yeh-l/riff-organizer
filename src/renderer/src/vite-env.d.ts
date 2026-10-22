/// <reference types="vite/client" />

declare module "*.css" {
  const content: { [key: string]: string }
  export default content
}

declare module "*?worklet" {
  const source: string
  export default source
}
