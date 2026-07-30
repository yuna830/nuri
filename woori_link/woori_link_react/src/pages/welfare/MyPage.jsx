import ConsentManagement from '../../components/common/ConsentManagement.jsx';
import { getUser } from '../../utils/auth.js';
import '../../css/welfare/MyPage.css';

export default function WelfareMyPage() {
  const user = getUser('WELFARE_WORKER') || getUser();

  return (
    <div className="welfare-mypage">
      <header className="welfare-mypage__heading">
        <h1>마이페이지</h1>
        <p>업무 계정과 개인정보 처리 범위를 확인합니다.</p>
      </header>

      <section className="welfare-mypage__profile">
        <div className="welfare-mypage__avatar">{user?.name?.slice(0, 1) || '복'}</div>
        <div>
          <span>복지사 계정</span>
          <h2>{user?.name || '담당 복지사'} 님</h2>
          <p>담당 대상자의 정보는 업무 수행에 필요한 범위에서만 조회해야 합니다.</p>
        </div>
      </section>

      <ConsentManagement role="welfare" />

      <section className="welfare-mypage__access">
        <h2>담당 대상자 정보 이용 원칙</h2>
        <div>
          <p><strong>담당자 범위 확인</strong><span>배정된 어르신의 정보만 조회합니다.</span></p>
          <p><strong>동의 범위 준수</strong><span>어르신이 동의한 목적과 항목 안에서 처리합니다.</span></p>
          <p><strong>접근 기록 관리</strong><span>조회·수정·다운로드 행위는 감사 기록 대상으로 관리합니다.</span></p>
        </div>
      </section>
    </div>
  );
}
