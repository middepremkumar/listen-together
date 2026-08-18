import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getRoomInfo } from '../services/api.js';
import { saveName, getSavedName } from '../utils/session.js';
import { useToast } from '../context/ToastContext.jsx';

export default function JoinRoom() {
  const { roomId: roomIdFromUrl } = useParams();
  const [roomId, setRoomId] = useState(roomIdFromUrl?.toUpperCase() || '');
  const [name, setName] = useState(getSavedName());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  async function handleJoin(e) {
    e.preventDefault();
    setError('');

    const code = roomId.trim().toUpperCase();
    const trimmedName = name.trim();

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
      saveName(trimmedName);
      navigate(`/room/${code}`, { state: { name: trimmedName, isCreator: false } });
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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <form onSubmit={handleJoin} className="card w-full max-w-md p-8 animate-slide-up">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-50 mt-4 mb-1">Join a Room</h1>
        <p className="text-gray-400 text-sm mb-6">
          Enter the room code your friend shared with you.
        </p>

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
          className="input-field mb-1"
          placeholder="e.g. Sumi"
          value={name}
          maxLength={24}
          autoFocus={!!roomIdFromUrl}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
          {loading ? 'Joining…' : 'Join Room'}
        </button>
      </form>
    </div>
  );
}
