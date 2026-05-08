// routes 폴더 안에 있는 AppRoutes.jsx 파일을 불러옴
// AppRoutes는 목록 페이지와 상세 페이지를 URL로 연결함
import AppRoutes from "./routes/AppRoutes";

// App 컴포넌트
// React 프로젝트에서 가장 중심이 되는 화면
function App() {
  // 라우터에 등록된 페이지를 화면에 보여줌
  return <AppRoutes />;
}

// App 컴포넌트를 다른 파일(main.jsx)에서 사용할 수 있도록 내보내기
export default App;
