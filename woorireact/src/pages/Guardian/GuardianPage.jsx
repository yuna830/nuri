import "./GuardianPage.css";

function GuardianPage() {
  return (
    <main className="guardian-page">
      <header className="guardian-header">
        <div className="header-left">
          <div className="logo-box">누리</div>
          <strong className="service-name">누리</strong>
          <span className="guardian-name">보호자: 김민지</span>
        </div>

        <div className="header-right">
          <button className="alarm-button" type="button">
            알림
            <span className="alarm-count">2</span>
          </button>

          <button className="emergency-button" type="button">
            긴급 신고
          </button>
        </div>
      </header>

      <nav className="elder-tabs" aria-label="담당 노인 목록">
        <button className="elder-tab active" type="button">
          <span>어머니 (이영희)</span>
          <span className="status-badge normal">정상</span>
        </button>

        <button className="elder-tab" type="button">
          <span>아버지 (이철수)</span>
          <span className="status-badge danger">이탈</span>
        </button>

        <button className="elder-tab" type="button">
          <span>할머니 (박순자)</span>
          <span className="status-badge offline">GPS 미수신</span>
        </button>
      </nav>

      <section className="guardian-dashboard">
        <div className="dashboard-left">
          <section className="card location-card">
            <div className="card-header">
              <h2>실시간 위치</h2>
              <span className="last-update">마지막 갱신: 2분 전</span>
            </div>

            <div className="map-area">
              <div className="location-info-box">
                <span>현재 위치</span>
                <strong>서울시 강남구 역삼동 123-45</strong>
                <p>역삼역 2번 출구 인근</p>
              </div>

              <div className="safe-circle" />
              <div className="route-dashed-line" />
              <div className="map-pin">⌖</div>

              <div className="map-legend">
                <p>
                  <span className="legend-dot" /> 현재 위치
                </p>
                <p>
                  <span className="legend-line" /> 안전 반경 (500m)
                </p>
                <p>
                  <span className="legend-dashed" /> 이동 경로
                </p>
                <p>
                  <span className="legend-dot muted" /> 안전 반경 중심 (자택)
                </p>
              </div>
            </div>
          </section>

          <section className="card alert-log-card">
            <div className="card-header">
              <h2>이탈 알림 로그</h2>
            </div>

            <div className="alert-list">
              <div className="alert-item warning">
                <div className="alert-icon">!</div>
                <div className="alert-content">
                  <strong>05/04 14:23</strong>
                  <p>서울시 강남구 테헤란로 123</p>
                  <span>안전반경 +250m</span>
                </div>
                <div className="alert-actions">
                  <span>확인됨</span>
                  <button type="button">복지사 알림 완료</button>
                </div>
              </div>

              <div className="alert-item warning">
                <div className="alert-icon">!</div>
                <div className="alert-content">
                  <strong>05/03 09:15</strong>
                  <p>서울시 서초구 서초대로 456</p>
                  <span>안전반경 +180m</span>
                </div>
                <div className="alert-actions">
                  <span>확인됨</span>
                  <button type="button">복지사 알림 완료</button>
                </div>
              </div>

              <div className="alert-item done">
                <div className="alert-icon">✓</div>
                <div className="alert-content">
                  <strong>05/02 16:44</strong>
                  <p>서울시 강남구 강남대로 789</p>
                  <span>안전반경 +50m</span>
                </div>
                <div className="alert-actions">
                  <span>확인됨</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="dashboard-right">
          <section className="card status-card">
            <div className="card-header">
              <h2>상태 요약</h2>
            </div>

            <div className="status-summary-main">
              <span>현재 상태</span>
              <strong>정상</strong>
              <p>안전 반경 내</p>
            </div>

            <div className="summary-box">
              <span>현재 위치</span>
              <strong>서울시 강남구 역삼동 123-45</strong>
            </div>

            <div className="summary-box">
              <span>안전 반경 중심</span>
              <strong>자택 (역삼동 100)</strong>
            </div>

            <div className="summary-box">
              <span>안전 반경</span>
              <strong>500m</strong>
            </div>

            <div className="summary-box">
              <span>GPS 배터리</span>
              <div className="battery-row">
                <div className="battery-bar">
                  <div />
                </div>
                <strong>75%</strong>
              </div>
            </div>

            <button className="confirm-button" type="button">
              확인 완료
            </button>
          </section>

          <section className="card route-card">
            <div className="card-header">
              <h2>이동 경로 이력</h2>
            </div>

            <select className="date-select" defaultValue="2026-05-04">
              <option value="2026-05-04">2026-05-04 (오늘)</option>
            </select>

            <ul className="route-list">
              <li>
                <span>15:30</span>
                <strong>자택 인근</strong>
              </li>
              <li>
                <span>14:20</span>
                <strong>역삼역 공원</strong>
              </li>
              <li>
                <span>12:00</span>
                <strong>강남구 복지관</strong>
              </li>
              <li>
                <span>10:30</span>
                <strong>역삼동 마트</strong>
              </li>
              <li>
                <span>09:00</span>
                <strong>자택</strong>
              </li>
            </ul>

            <button className="outline-button" type="button">
              경로 내보내기
            </button>
          </section>

          <section className="card report-card">
            <div className="report-header">
              <h2>실종 신고</h2>
            </div>

            <div className="last-seen-box">
              <span>마지막 목격 위치</span>
              <strong>역삼역 2번 출구</strong>
              <p>05/04 14:23</p>
            </div>

            <label className="form-label">
              확인 정보
              <input
                type="text"
                placeholder="예: 파란색 체크 셔츠, 베이지 바지, 검색 운동화"
              />
            </label>

            <label className="form-label">
              특이사항
              <textarea placeholder="걸음걸이, 소지품, 특징 등을 입력해주세요" />
            </label>

            <button className="outline-button" type="button">
              사진 등록
            </button>

            <button className="report-button" type="button">
              안전드림 연계 신고
            </button>

            <p className="report-help">
              긴급 상황 시 112 또는 182로 즉시 신고하세요
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default GuardianPage;
