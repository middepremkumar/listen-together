import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRoom } from '../services/api.js';
import { saveName, getSavedName } from '../utils/session.js';
import { useToast } from '../context/ToastContext.jsx';

export default function CreateRoom() {
  const [name, setName] = useState(getSavedName());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

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
      navigate(`/room/${data.roomId}`, { state: { name: trimmed, isCreator: true } });
    } catch (err) {
      setError(err.message || 'Failed to create room. Please try again.');
      toast.error(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <form onSubmit={handleCreate} className="card w-full max-w-md p-8 animate-slide-up">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-50 mt-4 mb-1">Create a Room</h1>
        <p className="text-gray-400 text-sm mb-6">
          You'll become the host and can invite friends with a link.
        </p>

        <label className="block text-xs font-semibold text-gray-400 mb-2" htmlFor="name">
          Display name
        </label>
        <input
          id="name"
          className="input-field mb-1"
          placeholder="e.g. Prem"
          value={name}
          maxLength={24}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
          {loading ? 'Creating room…' : 'Create Room'}
        </button>
      </form>
    </div>
  );
}
