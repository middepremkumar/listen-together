import React, { useState } from 'react';

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600'
];

function getGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name = 'User',
  picture = '',
  size = 'md', // xs | sm | md | lg
  className = ''
}) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base'
  }[size] || 'w-9 h-9 text-sm';

  if (picture && !imageError) {
    return (
      <img
        src={picture}
        alt={name}
        onError={() => setImageError(true)}
        className={`${sizeClasses} rounded-full object-cover ring-1 ring-white/10 shrink-0 ${className}`}
      />
    );
  }

  const gradient = getGradient(name);
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center select-none shadow-xs ring-1 ring-white/10 shrink-0 ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
