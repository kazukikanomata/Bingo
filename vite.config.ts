import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// JS・CSS・フォントをすべて dist/index.html 1 ファイルに埋め込む。
// サーバー不要で、index.html をダブルクリック（file://）するだけで会場 PC で動く。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // Tauri の devUrl と一致させる（ポートがずれると起動しない）
  server: { port: 5173, strictPort: true },
  clearScreen: false,
  build: { chunkSizeWarningLimit: 4000, assetsInlineLimit: 100_000_000 },
})
