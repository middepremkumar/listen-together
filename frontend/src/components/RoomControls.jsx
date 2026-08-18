import React from 'react';

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
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-bg-border bg-bg-surface">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl">🎧</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-100">Listen Together</h1>
            <span className="hidden sm:inline text-xs text-gray-500 font-mono">· {roomId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className="text-[11px] text-gray-500">{status.label}</span>
            {locked && <span className="text-[11px] text-gray-500">· 🔒 Locked</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onCopyLink} className="btn-secondary !px-3 !py-2 text-xs">
          Copy link
        </button>
        {isHost && (
          <button onClick={onToggleLock} className="btn-secondary !px-3 !py-2 text-xs hidden sm:inline-block">
            {locked ? 'Unlock' : 'Lock'}
          </button>
        )}
        <button onClick={onLeave} className="btn-secondary !px-3 !py-2 text-xs text-red-400 border-red-900/50">
          Leave
        </button>
      </div>
    </header>
  );
}
