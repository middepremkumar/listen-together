import React from 'react';

export default function MembersList({ members, currentUserId, isHost, onKick, onTransferHost }) {
  const connected = members.filter((m) => m.connected);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-1">
        <span className="text-xs font-semibold text-gray-400">Online — {connected.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between gap-2 bg-bg-elevated border border-bg-border rounded-xl px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  m.connected ? 'bg-green-500' : 'bg-gray-600 animate-pulse-dot'
                }`}
              />
              <span className="text-sm text-gray-200 truncate">
                {m.name}
                {m.userId === currentUserId && <span className="text-gray-500"> (you)</span>}
              </span>
              {m.isHost && <span title="Host" className="text-xs">👑</span>}
              {!m.connected && <span className="text-[10px] text-gray-500">reconnecting…</span>}
            </div>

            {isHost && m.userId !== currentUserId && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  title="Make host"
                  onClick={() => onTransferHost(m.userId)}
                  className="text-[11px] text-gray-500 hover:text-accent-hover"
                >
                  Make host
                </button>
                <button
                  title="Kick"
                  onClick={() => onKick(m.userId)}
                  className="text-[11px] text-gray-500 hover:text-red-400"
                >
                  Kick
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
