import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const kakaoRestApiKey = (env.VITE_KAKAO_REST_API_KEY || '').trim()

  return {
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
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/senuri': {
        target: 'http://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/senuri/, ''),
      },
      '/seoul-openapi': {
        target: 'http://openapi.seoul.go.kr:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/seoul-openapi/, ''),
      },
      '/weather-api': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/weather-api/, ''),
        secure: false,
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        secure: false,
      },
      '/kakao-local': {
        target: 'https://dapi.kakao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kakao-local/, ''),
        secure: false,
        headers: kakaoRestApiKey
          ? { Authorization: `KakaoAK ${kakaoRestApiKey}` }
          : {},
      },
    }
  }
  }
})
