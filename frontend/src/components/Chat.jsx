import React, { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Chat({ messages, onSend, currentUserId }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-gray-400 text-xs font-medium">No messages yet.</p>
            <p className="text-gray-600 text-[11px]">Say hi to everyone in the room!</p>
          </div>
        )}
        {messages.map((m) =>
          m.type === 'system' ? (
            <div key={m.id} className="text-center py-1">
              <span className="text-[11px] text-gray-400 bg-bg-elevated/80 border border-bg-border/60 px-2.5 py-0.5 rounded-full inline-block">
                {m.text}
              </span>
            </div>
          ) : (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${
                m.senderId === currentUserId ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.senderId !== currentUserId && (
                <Avatar
                  name={m.sender}
                  picture={m.senderPicture}
                  size="xs"
                  className="mb-1"
                />
              )}

              <div
                className={`flex flex-col ${
                  m.senderId === currentUserId ? 'items-end' : 'items-start'
                } max-w-[78%]`}
              >
                {m.senderId !== currentUserId && (
                  <div className="flex items-center gap-1 ml-1 mb-0.5">
                    <span className="text-[11px] font-medium text-gray-300">
                      {m.sender}
                    </span>
                    {m.isAdmin && (
                      <span className="text-[9px] bg-amber-500/15 text-amber-300 font-semibold px-1 rounded border border-amber-500/30">
                        👑 Admin
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    m.senderId === currentUserId
                      ? 'bg-accent text-white rounded-br-xs shadow-sm'
                      : 'bg-bg-elevated text-gray-100 rounded-bl-xs border border-bg-border shadow-xs'
                  }`}
                >
                  <div className="break-words whitespace-pre-wrap">{m.text}</div>
                </div>
                <span className="text-[9px] text-gray-400 mt-0.5 px-1">
                  {formatTimestamp(m.timestamp)}
                </span>
              </div>

              {m.senderId === currentUserId && (
                <Avatar
                  name={m.sender || 'You'}
                  picture={m.senderPicture}
                  size="xs"
                  className="mb-1"
                />
              )}
            </div>
          )
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-bg-border bg-bg-surface">
        <input
          className="input-field flex-1 !py-2.5 !text-xs"
          placeholder="Type a message…"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary !px-4 !py-2.5 text-xs flex items-center gap-1 font-semibold"
          disabled={!text.trim()}
        >
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
