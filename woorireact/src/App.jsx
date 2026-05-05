// pages 폴더 안에 있는 WelfareDashboard.jsx 파일을 불러옴
// WelfareDashboard는 복지사 대상자 관리 페이지 컴포넌트
import WelfareDashboard from "./pages/Common/WelfareDashboard";

// App 컴포넌트
// React 프로젝트에서 가장 중심이 되는 화면
function App() {
  // 현재는 복지사 대상자 관리 페이지 하나만 화면에 보여줌
  return <WelfareDashboard />;
}

// App 컴포넌트를 다른 파일(main.jsx)에서 사용할 수 있도록 내보내기
export default App;