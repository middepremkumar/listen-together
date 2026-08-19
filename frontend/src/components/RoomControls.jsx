import React, { useState } from 'react';
import UserMenu from './UserMenu.jsx';

const STATUS_STYLES = {
  connected: { dot: 'bg-green-500', label: 'Connected' },
  connecting: { dot: 'bg-yellow-500 animate-pulse-dot', label: 'Connecting…' },
  reconnecting: { dot: 'bg-yellow-500 animate-pulse-dot', label: 'Reconnecting…' },
  disconnected: { dot: 'bg-red-500', label: 'Disconnected' }
};

export default function RoomControls({
  roomId,
  connectionState,
  isHost,
  locked,
  hasPassword,
  onCopyLink,
  onToggleLock,
  onSetPassword,
  onLeave
}) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPwdText, setShowPwdText] = useState(false);
  const status = STATUS_STYLES[connectionState] || STATUS_STYLES.connecting;

  function handleSavePassword(e) {
    e.preventDefault();
    if (onSetPassword) {
      onSetPassword(newPassword.trim());
      setShowPasswordModal(false);
      setNewPassword('');
    }
  }

  function handleRemovePassword() {
    if (onSetPassword) {
      onSetPassword('');
      setShowPasswordModal(false);
      setNewPassword('');
    }
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-bg-border bg-bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">🎧</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-100">Listen Together</h1>
              <span className="hidden sm:inline text-xs text-gray-400 font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-bg-border">
                {roomId}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              <span className="text-[11px] text-gray-400">{status.label}</span>
              {hasPassword && (
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  <span>🔒</span> Passcode Protected
                </span>
              )}
              {locked && <span className="text-[11px] text-red-400 font-medium">· 🔒 Locked</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onCopyLink} className="btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5">
            <span>📋</span>
            <span className="hidden sm:inline">Copy link</span>
          </button>
          {isHost && (
            <>
              <button
                onClick={() => setShowPasswordModal(true)}
                className={`btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1 ${
                  hasPassword ? 'border-amber-500/40 text-amber-300' : ''
                }`}
                title="Room password settings"
              >
                <span>🔑</span>
                <span className="hidden md:inline">{hasPassword ? 'Password Set' : 'Set Password'}</span>
              </button>
              <button onClick={onToggleLock} className="btn-secondary !px-3 !py-1.5 text-xs hidden sm:inline-block">
                {locked ? '🔓 Unlock' : '🔒 Lock'}
              </button>
            </>
          )}
          <button onClick={onLeave} className="btn-secondary !px-3 !py-1.5 text-xs text-red-400 hover:text-red-300 border-red-900/40">
            Leave
          </button>
          <div className="pl-1 border-l border-bg-border hidden sm:block">
            <UserMenu compact />
          </div>
        </div>
      </header>

      {/* Host Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔑</span>
                <h2 className="text-base font-bold text-gray-100">Room Password Settings</h2>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-200 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              {hasPassword
                ? 'This room currently requires a passcode for new guests to enter. You can update or remove it.'
                : 'Set a passcode so only people with the password can enter this room.'}
            </p>

            <form onSubmit={handleSavePassword}>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5" htmlFor="hostRoomPassword">
                {hasPassword ? 'New Password (or leave blank to remove)' : 'Room Passcode / Password'}
              </label>
              <div className="relative mb-4">
                <input
                  id="hostRoomPassword"
                  type={showPwdText ? 'text' : 'password'}
                  className="input-field pr-16 text-sm"
                  placeholder="Enter passcode"
                  value={newPassword}
                  maxLength={32}
                  autoFocus
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwdText(!showPwdText)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5"
                >
                  {showPwdText ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {hasPassword && (
                  <button
                    type="button"
                    onClick={handleRemovePassword}
                    className="btn-secondary !py-1.5 !px-3 text-xs text-red-400 hover:text-red-300 mr-auto"
                  >
                    Remove Password
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasPassword && !newPassword.trim()}
                  className="btn-primary !py-1.5 !px-4 text-xs"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

