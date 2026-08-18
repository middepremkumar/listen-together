import React, { useState } from 'react';
import { isValidYouTubeUrl, formatDuration } from '../utils/youtube.js';

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
            className="input-field flex-1 !py-2.5"
            placeholder="Paste a YouTube link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" disabled={adding} className="btn-primary !px-4 !py-2.5 whitespace-nowrap">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {localError && <p className="text-red-400 text-xs">{localError}</p>}
      </form>

      <div className="flex items-center justify-between px-3 pt-2">
        <span className="text-xs font-semibold text-gray-400">Up next ({queue.length})</span>
        {isHost && queue.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-400">
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {queue.length === 0 && (
          <p className="text-center text-gray-600 text-xs mt-6">Queue is empty. Add a video above.</p>
        )}
        {queue.map((item, idx) => (
          <div key={item.id} className="flex gap-2 bg-bg-elevated border border-bg-border rounded-xl p-2">
            <img
              src={item.thumbnail}
              alt=""
              className="w-20 h-12 rounded-lg object-cover flex-shrink-0 bg-bg-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-100 truncate">{item.title}</p>
              <p className="text-[11px] text-gray-500">
                Added by {item.addedBy}
                {item.duration ? ` · ${formatDuration(item.duration)}` : ''}
              </p>
            </div>
            {isHost && (
              <div className="flex flex-col gap-1 flex-shrink-0">
                {idx === 0 && (
                  <button
                    title="Play now"
                    onClick={() => onPlayNext()}
                    className="text-accent hover:text-accent-hover text-sm"
                  >
                    ▶
                  </button>
                )}
                <button
                  title="Remove"
                  onClick={() => onRemove(item.id)}
                  className="text-gray-500 hover:text-red-400 text-sm"
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
