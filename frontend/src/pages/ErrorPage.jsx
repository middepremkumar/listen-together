import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ErrorPage({
  title = 'Something went wrong',
  message = 'Please try again.',
  icon = '⚠️',
  actionLabel = 'Back to home',
  onAction
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="card w-full max-w-md p-8 text-center animate-slide-up">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-gray-100 mb-2">{title}</h1>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <button
          className="btn-primary w-full"
          onClick={() => (onAction ? onAction() : navigate('/'))}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
