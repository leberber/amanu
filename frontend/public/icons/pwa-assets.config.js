// pwa-assets.config.js
import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 72, 96, 128, 144, 152, 192, 384, 512],
      favicons: [[48, 'favicon.ico']]
    },
    maskable: {
      sizes: [64, 72, 96, 128, 144, 152, 192, 384, 512],
      padding: 0.1
    },
    apple: {
      sizes: [57, 60, 72, 76, 114, 120, 144, 152, 167, 180],
      padding: 0.1
    }
  },
  images: ['elsuq.png'],
  outDir: 'public/icons'
})