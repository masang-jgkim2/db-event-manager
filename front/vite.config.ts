import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // 0.0.0.0 바인딩 — 같은 네트워크 외부 PC에서 접근 가능
    port: 5173,
  },
})
