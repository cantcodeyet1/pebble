import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePebbleStore } from '../store';

export const BottomNav = () => {
  const boutOpen = usePebbleStore(s => s.boutOpen);
  const setAddOpen = usePebbleStore(s => s.setAddOpen);

  if (boutOpen) return null;

  return (
    <nav className="tab-bar">
      {/* Ecclesia */}
      <NavLink to="/" end className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <svg className="ti-i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          <path d="M9 21V12h6v9"/>
        </svg>
        <div className="ti-l">Ecclesia</div>
      </NavLink>

      {/* Palaestra */}
      <NavLink to="/palaestra" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <svg className="ti-i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"/>
        </svg>
        <div className="ti-l">Palaestra</div>
      </NavLink>

      {/* FAB — Add */}
      <button className="tab-fab" onClick={() => setAddOpen(true)}>
        <div className="fab-c">+</div>
        <div className="fab-l">Add</div>
      </button>

      {/* Callistratum */}
      <NavLink to="/library" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <svg className="ti-i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          <line x1="9" y1="7" x2="15" y2="7"/>
          <line x1="9" y1="11" x2="15" y2="11"/>
        </svg>
        <div className="ti-l">Callistratum</div>
      </NavLink>

      {/* Philippics */}
      <NavLink to="/stats" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
        <svg className="ti-i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <div className="ti-l">Philippics</div>
      </NavLink>
    </nav>
  );
};
