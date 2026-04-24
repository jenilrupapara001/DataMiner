import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const domain = env.VITE_API_URL ? new URL(env.VITE_API_URL).hostname : 'data.brandcentral.in';
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'CometChat': path.resolve(__dirname, './src/CometChat'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
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
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      allowedHosts: [
        domain,
        `www.${domain}`,
        'data.brandcentral.in',
        'www.data.brandcentral.in',
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
      ],
    },
  }
})

