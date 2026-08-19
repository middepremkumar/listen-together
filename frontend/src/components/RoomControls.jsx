import React from 'react';
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
  onCopyLink,
  onToggleLock,
  onLeave
}) {
  const status = STATUS_STYLES[connectionState] || STATUS_STYLES.connecting;

  return (
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
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className="text-[11px] text-gray-400">{status.label}</span>
            {locked && <span className="text-[11px] text-amber-400 font-medium">· 🔒 Locked</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onCopyLink} className="btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5">
          <span>📋</span>
          <span className="hidden sm:inline">Copy link</span>
        </button>
        {isHost && (
          <button onClick={onToggleLock} className="btn-secondary !px-3 !py-1.5 text-xs hidden sm:inline-block">
            {locked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
        )}
        <button onClick={onLeave} className="btn-secondary !px-3 !py-1.5 text-xs text-red-400 hover:text-red-300 border-red-900/40">
          Leave
        </button>
        <div className="pl-1 border-l border-bg-border hidden sm:block">
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}
