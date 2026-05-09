import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  appType: 'spa',   // ← 이거 추가
  server: {
    proxy: {
      '/health': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/health/, ''),
        secure: false,
      },
      '/airkorea': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/airkorea/, ''),
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/senuri': {
        target: 'http://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/senuri/, ''),
      },
      '/weather-api': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/weather-api/, ''),
        secure: false,
      },
    }
  }
})