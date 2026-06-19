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
    ssr: {
      noExternal: [
        'bootstrap',
        'rsuite',
        '@emotion/cache',
        '@emotion/react',
        'antd',
        '@ant-design/cssinjs',
      ],
    },
    optimizeDeps: {
      include: [
        'bootstrap',
        'rsuite',
        '@emotion/cache',
        '@emotion/react',
        'antd',
        '@ant-design/cssinjs',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'CometChat': path.resolve(__dirname, './src/CometChat'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      target: 'es2020',        // Better tree-shaking + modern output
      sourcemap: false,        // Skip sourcemaps in production for smaller bundles
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // ── Core React runtime ───────────────────────────────────────────
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor_core';
              }
              // ── Ant Design (large, keeps it out of vendor_misc) ─────────────
              if (id.includes('/antd/') || id.includes('@ant-design') || id.includes('rc-')) {
                return 'vendor_antd';
              }
              // ── MUI + emotion + Bootstrap ────────────────────────────────────
              if (id.includes('@mui') || id.includes('@emotion') || id.includes('bootstrap')) {
                return 'vendor_ui';
              }
              // ── React Query ──────────────────────────────────────────────────
              if (id.includes('@tanstack')) {
                return 'vendor_query';
              }
              // ── Chart libraries ──────────────────────────────────────────────
              if (
                id.includes('apexcharts') || id.includes('chart.js') ||
                id.includes('recharts')   || id.includes('@mui/x-charts')
              ) {
                return 'vendor_charts';
              }
              // ── CometChat (very large, keep isolated) ────────────────────────
              if (id.includes('cometchat')) {
                return 'vendor_chat';
              }
              // ── Real-time + date + icons + HTTP ─────────────────────────────
              if (
                id.includes('lucide-react')   || id.includes('tabler-icons') ||
                id.includes('react-icons')    || id.includes('date-fns')     ||
                id.includes('axios')          || id.includes('socket.io-client')
              ) {
                return 'vendor_common';
              }
              // ── Excel / spreadsheet ─────────────────────────────────────────
              if (id.includes('xlsx')) {
                return 'vendor_xlsx';
              }
              // ── rsuite + date pickers ────────────────────────────────────────
              if (id.includes('rsuite') || id.includes('react-datepicker') || id.includes('react-day-picker')) {
                return 'vendor_forms';
              }
              return 'vendor_misc';
            }
          },
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
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
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

