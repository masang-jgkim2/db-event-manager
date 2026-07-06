import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 개발 — favicon 강한 캐시(지구본 기본 아이콘) 회피
if (import.meta.env.DEV) {
  const strFaviconHref = `/favicon.svg?v=${Date.now()}`
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((node) => {
    (node as HTMLLinkElement).href = strFaviconHref
  })
}

// 개발 시 API 연결 확인(상대 /api — Vite 프록시 경유). 콘솔에 건수가 0이면 백엔드·프록시·DATA_DIR 점검
if (import.meta.env.DEV) {
  fetch('/api/health')
    .then((r) => r.json())
    .then((d) => console.log('[DQPM] /api/health', d))
    .catch((e) => console.error('[DQPM] /api/health 실패 — 백엔드 기동·Vite 프록시 확인', e))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
