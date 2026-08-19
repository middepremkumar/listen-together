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
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  function handleTogglePassword(checked) {
    setEnablePassword(checked);
    if (checked && !password) {
      const generated = generateStrongPasskey();
      setPassword(generated);
      setShowPassword(true);
    }
  }

  function handleGenerateNewPasskey() {
    const generated = generateStrongPasskey();
    setPassword(generated);
    setShowPassword(true);
    toast.info(`Generated passkey: ${generated}`);
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

    const trimmedPassword = enablePassword ? password.trim() : '';
    if (enablePassword && !trimmedPassword) {
      setError('Please enter a room password or disable password protection.');
      return;
    }

    setLoading(true);
    try {
      const data = await createRoom(trimmed, trimmedPassword);
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
            You'll become the host and can invite friends with a link.
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

          {/* Optional Room Password */}
          <div className="p-4 rounded-xl border border-bg-border bg-bg-elevated/50 mb-4 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔒</span>
                <div>
                  <div className="text-xs font-semibold text-gray-200">Room Password / Passkey</div>
                  <div className="text-[11px] text-gray-400">Guests can join directly using just this passkey</div>
                </div>
              </div>
              <input
                type="checkbox"
                id="enablePassword"
                checked={enablePassword}
                onChange={(e) => handleTogglePassword(e.target.checked)}
                className="w-4 h-4 rounded border-gray-700 bg-bg text-brand-purple focus:ring-brand-purple focus:ring-offset-bg"
              />
            </div>

            {enablePassword && (
              <div className="mt-3 pt-3 border-t border-bg-border/60 animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-medium text-gray-400" htmlFor="roomPassword">
                    Unique Passkey
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateNewPasskey}
                    className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>🎲</span> Generate Strong Passkey
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="roomPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-16 text-sm font-mono tracking-wide"
                    placeholder="e.g. cosmic-beat-42"
                    value={password}
                    maxLength={32}
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
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Share this password with friends so they can enter your room directly.
                </p>
              </div>
            )}
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
