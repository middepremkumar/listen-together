import React from 'react';
import Avatar from './Avatar.jsx';

export default function MembersList({
  members,
  currentUserId,
  isHost,
  isAdmin,
  onKick,
  onTransferHost,
  onTransferAdmin
}) {
  const connected = members.filter((m) => m.connected);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-bg-border/40">
        <span className="text-xs font-semibold text-gray-400">Members in Room</span>
        <span className="text-[11px] font-mono bg-bg-elevated px-2 py-0.5 rounded-full text-emerald-400 border border-emerald-500/20">
          {connected.length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between gap-2 bg-bg-elevated/70 hover:bg-bg-elevated border border-bg-border rounded-xl p-2.5 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <Avatar name={m.name} picture={m.picture} size="sm" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-surface ${
                    m.connected ? 'bg-green-500' : 'bg-gray-500 animate-pulse-dot'
                  }`}
                  title={m.connected ? 'Online' : 'Reconnecting'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-gray-200 truncate max-w-[120px]">
                    {m.name}
                  </span>
                  {m.userId === currentUserId && (
                    <span className="text-[10px] text-gray-500 font-medium">(you)</span>
                  )}
                  {m.isAdmin && (
                    <span
                      title="Group Admin"
                      className="text-[10px] bg-amber-500/15 text-amber-300 font-semibold px-1.5 py-0.2 rounded-full border border-amber-500/30 flex items-center gap-0.5"
                    >
                      👑 Admin
                    </span>
                  )}
                  {m.isHost && !m.isAdmin && (
                    <span
                      title="Current Playback Host"
                      className="text-[10px] bg-brand-purple/20 text-brand-purple-light font-medium px-1.5 py-0.2 rounded-full border border-brand-purple/30"
                    >
                      Host
                    </span>
                  )}
                </div>
                {!m.connected && (
                  <span className="text-[10px] text-yellow-500/80 block">reconnecting…</span>
                )}
              </div>
            </div>

            {(isHost || isAdmin) && m.userId !== currentUserId && (
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {isAdmin && !m.isAdmin && (
                  <button
                    title={`Make ${m.name} the Group Admin`}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to make ${m.name} the Group Admin?`)) {
                        onTransferAdmin?.(m.userId);
                      }
                    }}
                    className="text-[10px] px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg transition border border-amber-500/30 flex items-center gap-1 font-medium"
                  >
                    <span>👑</span>
                    <span>Make Admin</span>
                  </button>
                )}
                {!m.isHost && (
                  <button
                    title="Make playback host"
                    onClick={() => onTransferHost?.(m.userId)}
                    className="text-[11px] px-2 py-1 bg-bg-surface hover:bg-accent/20 hover:text-accent-hover text-gray-400 rounded-lg transition border border-bg-border"
                  >
                    Make host
                  </button>
                )}
                <button
                  title="Kick member"
                  onClick={() => onKick?.(m.userId)}
                  className="text-[11px] px-2 py-1 bg-bg-surface hover:bg-red-500/20 hover:text-red-400 text-gray-400 rounded-lg transition border border-bg-border"
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
