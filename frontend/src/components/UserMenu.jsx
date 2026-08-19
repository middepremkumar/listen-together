import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';
import GoogleAuthButton from './GoogleAuthButton.jsx';

export default function UserMenu({ compact = false }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    setOpen(false);
    toast.info('Signed out successfully.');
  }

  if (!isAuthenticated || !user) {
    return <GoogleAuthButton compact={compact} />;
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-bg-surface hover:bg-bg-elevated border border-bg-border transition duration-150 active:scale-[0.98] outline-none"
        aria-expanded={open}
      >
        <Avatar name={user.name} picture={user.picture} size="sm" />
        <span className="text-xs font-medium text-gray-200 max-w-[110px] truncate">
          {user.name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-bg-surface border border-bg-border shadow-2xl p-3 z-50 animate-slide-up">
          <div className="flex items-center gap-3 p-2 border-b border-bg-border pb-3 mb-2">
            <Avatar name={user.name} picture={user.picture} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-100 truncate">{user.name}</div>
              <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
              <div className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                <span>✓</span> Google Verified
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition duration-150 text-left font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
