import React from 'react';
import { Link } from 'react-router-dom';
import UserMenu from './UserMenu.jsx';

export default function Navbar() {
  return (
    <header className="w-full border-b border-bg-border/60 bg-bg/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-lg group-hover:scale-105 transition duration-150">
            🎧
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-gray-100 group-hover:text-white transition">
            Listen Together
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}
