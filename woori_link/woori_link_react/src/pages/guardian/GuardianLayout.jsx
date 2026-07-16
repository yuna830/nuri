import { useState } from 'react';

import GuardianSidebar from './GuardianSidebar.jsx';

import '../../css/guardian/GuardianLayout.css';


export default function GuardianLayout({
  activeMenu,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="guardian-layout">
      <GuardianSidebar
        activeMenu={activeMenu}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="guardian-layout__main">
        <header className="guardian-mobile-header">
          <button
            type="button"
            className="guardian-mobile-header__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="메뉴 열기"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="guardian-mobile-header__brand">
            <strong>WOORI</strong>
            <span>보호자</span>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}