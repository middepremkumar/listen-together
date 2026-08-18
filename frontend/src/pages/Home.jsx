import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 mb-6">
            <span className="text-3xl">🎧</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-50 mb-3 tracking-tight">
            Listen Together
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-10 leading-relaxed">
            Create a room, share the link, and watch or listen to YouTube videos
            in perfect sync with friends — wherever they are.
          </p>

          <div className="flex flex-col gap-3">
            <button className="btn-primary" onClick={() => navigate('/create')}>
              Create a Room
            </button>
            <button className="btn-secondary" onClick={() => navigate('/join')}>
              Join a Room
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-12 text-left">
            <Feature icon="💬" label="Live chat" />
            <Feature icon="🎬" label="Synced playback" />
            <Feature icon="📃" label="Shared queue" />
          </div>
        </div>
      </div>
      <footer className="text-center text-xs text-gray-600 pb-6">
        Built for friends, far apart.
      </footer>
    </div>
  );
}

function Feature({ icon, label }) {
  return (
    <div className="card p-3 flex flex-col items-center gap-1.5 text-center">
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] text-gray-400 font-medium">{label}</span>
    </div>
  );
}
