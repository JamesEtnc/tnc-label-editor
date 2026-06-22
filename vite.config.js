import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // react-draggable (used by react-rnd) references process.env.NODE_ENV
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
