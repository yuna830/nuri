// React의 StrictMode를 불러옴
// 개발 중에 잠재적인 문제를 더 잘 확인할 수 있게 도와주는 기능
import { StrictMode } from 'react'

// React 화면을 브라우저에 그려주는 createRoot 기능을 불러옴
import { createRoot } from 'react-dom/client'

// 전체 CSS 파일 불러오기
import './index.css'

// App.jsx 파일을 불러옴
// App.jsx 안에서 WelfareDashboard 페이지를 보여주고 있음
import App from './App.jsx'
import { initFontSize } from './components/FontSizeControl.jsx'

// 저장된 글씨 크기 즉시 적용 (렌더링 전)
initFontSize()

// index.html 안에 있는 id = "root"인 요소를 찾고,
// 그 안에 React 앱을 렌더링함
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* App 컴포넌트를 화면에 출력 */}
    <App />
  </StrictMode>,
)
