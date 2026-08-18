import React, { useEffect, useRef, useState } from 'react';

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
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-xs mt-6">No messages yet. Say hi 👋</p>
        )}
        {messages.map((m) =>
          m.type === 'system' ? (
            <div key={m.id} className="text-center">
              <span className="text-[11px] text-gray-500 italic">{m.text}</span>
            </div>
          ) : (
            <div
              key={m.id}
              className={`flex flex-col ${m.senderId === currentUserId ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.senderId === currentUserId
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-bg-elevated text-gray-100 rounded-bl-sm border border-bg-border'
                }`}
              >
                {m.senderId !== currentUserId && (
                  <div className="text-[11px] font-semibold text-accent-hover mb-0.5">{m.sender}</div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.text}</div>
              </div>
              <span className="text-[10px] text-gray-600 mt-0.5 px-1">{formatTimestamp(m.timestamp)}</span>
            </div>
          )
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-bg-border">
        <input
          className="input-field flex-1 !py-2.5"
          placeholder="Type a message…"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary !px-4 !py-2.5" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
