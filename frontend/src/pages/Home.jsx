import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Avatar from '../components/Avatar.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg text-center animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 mb-6 shadow-glow">
            <span className="text-3xl">🎧</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-50 mb-3 tracking-tight">
            Listen Together
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-8 leading-relaxed max-w-md mx-auto">
            Create a room, share the link, and watch or listen to YouTube videos
            in perfect sync with friends — wherever they are.
          </p>

          {/* Authentication banner / Quick status */}
          {isAuthenticated && user ? (
            <div className="card p-4 mb-6 flex items-center justify-between gap-3 text-left bg-gradient-to-r from-bg-surface to-bg-elevated border-accent/25 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={user.name} picture={user.picture} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-100 truncate">{user.name}</span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold px-1.5 py-0.2 rounded">
                      Google
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
                </div>
              </div>
              <span className="text-xs text-accent-hover font-medium">Ready</span>
            </div>
          ) : (
            <div className="card p-4 mb-6 flex flex-col items-center gap-2.5 bg-bg-surface/80">
              <span className="text-xs text-gray-400 font-medium">
                Sign in with Google to sync your profile & avatar
              </span>
              <GoogleAuthButton compact={false} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button className="btn-primary flex items-center justify-center gap-2" onClick={() => navigate('/create')}>
              <span>✨</span>
              <span>Create a Room</span>
            </button>
            <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => navigate('/join')}>
              <span>🚪</span>
              <span>Join a Room</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-10 text-left">
            <Feature icon="💬" title="Live chat" desc="Chat with avatars" />
            <Feature icon="🎬" title="Synced playback" desc="Sub-second sync" />
            <Feature icon="📃" title="Shared queue" desc="Collaborative playlist" />
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-600 pb-6">
        Built for friends, far apart.
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="card p-3 flex flex-col items-center gap-1 text-center hover:border-bg-border/80 transition">
      <span className="text-xl mb-0.5">{icon}</span>
      <span className="text-xs text-gray-200 font-semibold">{title}</span>
      <span className="text-[10px] text-gray-500">{desc}</span>
    </div>
  );
}
