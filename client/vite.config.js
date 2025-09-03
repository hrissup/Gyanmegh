// client/vite.config.js

import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa' // Import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    // Add the PWA plugin configuration
    VitePWA({
      registerType: 'autoUpdate',
      // The manifest file defines the PWA's properties
      manifest: {
        name: 'Resilient Virtual Classroom',
        short_name: 'Classroom',
        description: 'A low-bandwidth virtual classroom.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // This configures the service worker
      workbox: {
        // This will cache all the necessary files (JS, CSS, HTML, etc.)
        // that are part of your application's build output.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
})