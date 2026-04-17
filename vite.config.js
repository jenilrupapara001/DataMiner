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
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@mui/material', '@mui/icons-material', 'bootstrap'],
          chat: ['@cometchat/chat-uikit-react', '@cometchat/chat-sdk-javascript', '@cometchat/calls-sdk-javascript'],
          charts: ['apexcharts', 'react-apexcharts', 'chart.js', 'react-chartjs-2'],
          utils: ['date-fns', 'axios', 'socket.io-client', 'lucide-react'],
        },
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
    allowedHosts: ['retailops.work.gd', 'www.retailops.work.gd'],
  },
})

