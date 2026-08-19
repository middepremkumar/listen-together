import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRoom } from '../services/api.js';
import { saveName, getSavedName } from '../utils/session.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import Avatar from '../components/Avatar.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';

export default function CreateRoom() {
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState(user?.name || getSavedName());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

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

    setLoading(true);
    try {
      const data = await createRoom(trimmed);
      saveName(trimmed);
      navigate(`/room/${data.roomId}`, {
        state: {
          name: trimmed,
          picture: user?.picture || '',
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
            className="input-field mb-1"
            placeholder="e.g. Prem"
            value={name}
            maxLength={24}
            autoFocus={!isAuthenticated}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
            {loading ? 'Creating room…' : 'Create Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
