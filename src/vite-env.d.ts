/// <reference types="vite/client" />

declare module '@neslinesli93/qpdf-wasm' {
  const createModule: (options?: any) => Promise<any>;
  export default createModule;
}
