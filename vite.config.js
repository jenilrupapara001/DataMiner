import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'CometChat': path.resolve(__dirname, './src/CometChat'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Adjust limit as needed
    rollupOptions: {
      manualChunks: (id) => {
        if (id.includes('node_modules')) {
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor_core';
          }
          if (id.includes('@mui') || id.includes('@emotion') || id.includes('bootstrap')) {
            return 'vendor_ui';
          }
          if (id.includes('apexcharts') || id.includes('chart.js') || id.includes('recharts') || id.includes('@mui/x-charts')) {
            return 'vendor_charts';
          }
          if (id.includes('cometchat')) {
            return 'vendor_chat';
          }
          if (id.includes('lucide-react') || id.includes('tabler-icons') || id.includes('react-icons') ||
            id.includes('date-fns') || id.includes('axios') || id.includes('socket.io-client')) {
            return 'vendor_common';
          }
          if (id.includes('xlsx')) {
            return 'vendor_xlsx';
          }
          return 'vendor_misc';
        }
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ['data.brandcentral.in', 'www.data.brandcentral.in'],
  },
})

