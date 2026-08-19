import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getRoomInfo } from '../services/api.js';
import { saveName, getSavedName } from '../utils/session.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Avatar from '../components/Avatar.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';

export default function JoinRoom() {
  const { roomId: roomIdFromUrl } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [roomId, setRoomId] = useState(roomIdFromUrl?.toUpperCase() || '');
  const [name, setName] = useState(user?.name || getSavedName());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  // Check if room code requires password whenever room code is valid
  useEffect(() => {
    const code = roomId.trim().toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(code)) {
      getRoomInfo(code)
        .then((info) => {
          if (info.hasPassword) {
            setRequiresPassword(true);
            const savedPwd = sessionStorage.getItem(`lt_room_pwd_${code}`) || '';
            if (savedPwd) setPassword(savedPwd);
          } else {
            setRequiresPassword(false);
          }
        })
        .catch(() => {
          // ignore error until submit
        });
    } else {
      setRequiresPassword(false);
    }
  }, [roomId]);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');

    const code = roomId.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();

    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setError('Enter a valid room code (letters and numbers).');
      return;
    }
    if (!trimmedName) {
      setError('Please enter a display name.');
      return;
    }

    setLoading(true);
    try {
      const info = await getRoomInfo(code);
      if (info.full) {
        setError('This room is full. Ask the host to make space.');
        return;
      }
      if (info.locked) {
        setError('This room is locked by the host.');
        return;
      }
      if (info.hasPassword) {
        setRequiresPassword(true);
        if (!trimmedPassword) {
          setError('This room requires a password. Please enter the passcode.');
          return;
        }
      }

      saveName(trimmedName);
      if (trimmedPassword) {
        sessionStorage.setItem(`lt_room_pwd_${code}`, trimmedPassword);
      }

      navigate(`/room/${code}`, {
        state: {
          name: trimmedName,
          picture: user?.picture || '',
          password: trimmedPassword,
          isCreator: false
        }
      });
    } catch (err) {
      if (err.status === 404) {
        setError('Room not found. Double-check the code and try again.');
      } else {
        setError(err.message || 'Failed to join room.');
        toast.error(err.message || 'Failed to join room.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <form onSubmit={handleJoin} className="card w-full max-w-md p-8 animate-slide-up">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-3">
            <span>←</span> Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-50 mb-1">Join a Room</h1>
          <p className="text-gray-400 text-sm mb-6">
            Enter the room code your friend shared with you.
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

          <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="roomId">
            Room code
          </label>
          <input
            id="roomId"
            className="input-field mb-4 tracking-widest uppercase font-mono"
            placeholder="A7K92"
            value={roomId}
            maxLength={8}
            autoFocus={!roomIdFromUrl}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          />

          <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            className="input-field mb-4"
            placeholder="e.g. Sumi"
            value={name}
            maxLength={24}
            autoFocus={!!roomIdFromUrl && !isAuthenticated}
            onChange={(e) => setName(e.target.value)}
          />

          {requiresPassword && (
            <div className="p-3.5 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-2">
                <span>🔒</span>
                <span>This room requires a password</span>
              </div>
              <div className="relative">
                <input
                  id="joinPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-16 text-sm bg-bg-surface border-amber-500/40 focus:border-amber-400 focus:ring-amber-500/20"
                  placeholder="Enter room password"
                  value={password}
                  maxLength={32}
                  autoFocus={requiresPassword}
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
            </div>
          )}

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Joining…' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
