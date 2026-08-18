import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message, { type = 'info', duration = 3500 } = {}) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = {
    showToast,
    success: (msg, opts) => showToast(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => showToast(msg, { ...opts, type: 'error' }),
    info: (msg, opts) => showToast(msg, { ...opts, type: 'info' })
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className={[
              'pointer-events-auto cursor-pointer animate-slide-up max-w-sm w-full sm:w-auto px-4 py-3 rounded-xl shadow-lg border text-sm font-medium',
              t.type === 'success' && 'bg-green-950 border-green-800 text-green-300',
              t.type === 'error' && 'bg-red-950 border-red-800 text-red-300',
              t.type === 'info' && 'bg-bg-elevated border-bg-border text-gray-200'
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
