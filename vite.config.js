import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gauss-dasahboard/', // 👈 mismo nombre del repo en GitHub
})
