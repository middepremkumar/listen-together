import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRoom } from '../services/api.js';
import { saveName, getSavedName } from '../utils/session.js';
import { generateStrongPasskey } from '../utils/passkeyGenerator.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Avatar from '../components/Avatar.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';

export default function CreateRoom() {
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState(user?.name || getSavedName());
  const [password, setPassword] = useState(() => generateStrongPasskey());
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  function handleGenerateNewPasskey() {
    const generated = generateStrongPasskey();
    setPassword(generated);
    setShowPassword(true);
    toast.info(`Generated new passkey: ${generated}`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display name.');
      return;
    }
    if (trimmed.length > 24) {
      setError('Display name must be 24 characters or fewer.');
      return;
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setError('Room password is required.');
      return;
    }

    setLoading(true);
    try {
      const data = await createRoom(trimmed, trimmedPassword, user?.userId);
      saveName(trimmed);
      if (trimmedPassword) {
        sessionStorage.setItem(`lt_room_pwd_${data.roomId}`, trimmedPassword);
      }
      navigate(`/room/${data.roomId}`, {
        state: {
          name: trimmed,
          picture: user?.picture || '',
          password: trimmedPassword,
          isCreator: true
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to create room. Please try again.');
      toast.error(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <form onSubmit={handleCreate} className="card w-full max-w-md p-8 animate-slide-up">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-3">
            <span>←</span> Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-50 mb-1">Create a Room</h1>
          <p className="text-gray-400 text-sm mb-6">
            You'll become the permanent <strong className="text-amber-400">👑 Group Admin</strong> and can invite friends with your passkey.
          </p>

          {/* If authenticated with Google, display account info */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 p-3 mb-5 bg-bg-elevated border border-bg-border rounded-xl">
              <Avatar name={user.name} picture={user.picture} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-200 truncate">{user.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{user.email}</div>
              </div>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                Google
              </span>
            </div>
          ) : (
            <div className="p-3 mb-5 bg-bg-elevated/60 border border-bg-border rounded-xl flex flex-col items-center gap-2 text-center">
              <span className="text-xs text-gray-400">Want to use your Google profile?</span>
              <GoogleAuthButton compact={false} />
            </div>
          )}

          <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            className="input-field mb-4"
            placeholder="e.g. Prem"
            value={name}
            maxLength={24}
            autoFocus={!isAuthenticated}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Mandatory Room Password / Passkey */}
          <div className="p-4 rounded-xl border border-bg-border bg-bg-elevated/60 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔑</span>
                <div>
                  <div className="text-xs font-semibold text-gray-200">Room Password / Passkey (Required)</div>
                  <div className="text-[11px] text-gray-400">Guests join directly by entering this passkey</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateNewPasskey}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium bg-accent/10 px-2 py-1 rounded-md"
              >
                <span>🎲</span> Generate New
              </button>
            </div>

            <div className="relative mt-2">
              <input
                id="roomPassword"
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-16 text-sm font-mono tracking-wide bg-bg-surface border-amber-500/30 focus:border-amber-400"
                placeholder="e.g. cosmic-beat-42"
                value={password}
                maxLength={32}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Share this passkey with friends to give them access to this room.
            </p>
          </div>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
            {loading ? 'Creating room…' : 'Create Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
