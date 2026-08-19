import React, { useState } from 'react';
import { isValidYouTubeUrl, formatDuration } from '../utils/youtube.js';
import Avatar from './Avatar.jsx';

export default function Queue({ queue, isHost, onAdd, onRemove, onClear, onPlayNext, adding }) {
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!isValidYouTubeUrl(url)) {
      setLocalError('Enter a valid YouTube URL.');
      return;
    }
    onAdd(url, (err) => {
      if (err) setLocalError(err);
      else setUrl('');
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <form onSubmit={handleSubmit} className="p-3 border-b border-bg-border space-y-2">
        <div className="flex gap-2">
          <input
            className="input-field flex-1 !py-2.5 !text-xs"
            placeholder="Paste a YouTube link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={adding}
            className="btn-primary !px-4 !py-2.5 text-xs whitespace-nowrap"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {localError && <p className="text-red-400 text-xs">{localError}</p>}
      </form>

      <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
        <span className="text-xs font-semibold text-gray-400">Up next ({queue.length})</span>
        {isHost && queue.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-400 transition">
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {queue.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">📃</div>
            <p className="text-gray-400 text-xs font-medium">Queue is empty.</p>
            <p className="text-gray-600 text-[11px]">Add YouTube videos to watch next!</p>
          </div>
        )}
        {queue.map((item, idx) => (
          <div
            key={item.id}
            className="flex gap-2.5 bg-bg-elevated/70 hover:bg-bg-elevated border border-bg-border rounded-xl p-2 transition"
          >
            <img
              src={item.thumbnail}
              alt=""
              className="w-20 h-12 rounded-lg object-cover flex-shrink-0 bg-bg-border shadow-xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-100 truncate">{item.title}</p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
                <Avatar name={item.addedBy} picture={item.addedByPicture} size="xs" />
                <span className="truncate">Added by {item.addedBy}</span>
                {item.duration ? <span>· {formatDuration(item.duration)}</span> : null}
              </div>
            </div>
            {isHost && (
              <div className="flex flex-col gap-1 flex-shrink-0 justify-center">
                {idx === 0 && (
                  <button
                    title="Play now"
                    onClick={() => onPlayNext()}
                    className="w-6 h-6 rounded-md bg-accent/20 text-accent hover:bg-accent hover:text-white flex items-center justify-center text-xs transition"
                  >
                    ▶
                  </button>
                )}
                <button
                  title="Remove"
                  onClick={() => onRemove(item.id)}
                  className="w-6 h-6 rounded-md bg-bg-surface hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center text-xs transition border border-bg-border"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
