/// <reference types="vite/client" />

declare module "*.svg?inline" {
  const src: string;
  export default src;
}

declare module "*.woff2?inline" {
  const src: string;
  export default src;
}
