import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-bg-border/70 bg-bg-surface/60 backdrop-blur-md mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Bio */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-base group-hover:scale-105 transition duration-150">
                🎧
              </div>
              <span className="font-bold text-base tracking-tight text-gray-100 group-hover:text-white transition">
                Listen Together
              </span>
            </Link>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-sm">
              Watch and listen to YouTube videos in real-time synchronized playback with friends anywhere in the world. Includes collaborative queues, live chat, and group rooms.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] bg-accent/10 border border-accent/25 text-accent-hover font-medium px-2 py-0.5 rounded-full">
                ⚡ Sub-Second Sync
              </span>
              <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-medium px-2 py-0.5 rounded-full">
                👑 WhatsApp Admin Mode
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Quick Navigation
            </h3>
            <ul className="flex flex-col gap-2 text-xs text-gray-400">
              <li>
                <Link to="/" className="hover:text-accent transition flex items-center gap-1.5">
                  <span>🏠</span> Home Dashboard
                </Link>
              </li>
              <li>
                <Link to="/create" className="hover:text-accent transition flex items-center gap-1.5">
                  <span>✨</span> Create a Room
                </Link>
              </li>
              <li>
                <Link to="/join" className="hover:text-accent transition flex items-center gap-1.5">
                  <span>🚪</span> Join with Passkey
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect & Tech */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Technology & Source
            </h3>
            <ul className="flex flex-col gap-2 text-xs text-gray-400">
              <li>
                <a
                  href="https://github.com/middepremkumar/listen-together"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition flex items-center gap-1.5 text-gray-300 font-medium"
                >
                  <span>🐙</span> GitHub Repository
                </a>
              </li>
              <li className="flex items-center gap-1.5">
                <span>🍃</span> MongoDB Atlas Database
              </li>
              <li className="flex items-center gap-1.5">
                <span>🔌</span> Socket.io Real-time Engine
              </li>
              <li className="flex items-center gap-1.5">
                <span>🔒</span> Google Identity Services
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-6 border-t border-bg-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>© {currentYear} Listen Together. Built with</span>
            <span className="text-red-500">❤️</span>
            <span>for friends far apart.</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400 text-xs">
            <span className="text-gray-600">•</span>
            <span>Ultra Low Latency Sync</span>
            <span className="text-gray-600">•</span>
            <span>Open Source</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
