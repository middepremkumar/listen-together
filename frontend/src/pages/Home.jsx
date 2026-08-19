import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fetchUserRooms, deleteRoomApi } from '../services/api.js';
import {
  getUserId,
  getSavedName,
  getSavedCreatedRoomIds,
  getSavedJoinedRoomIds,
  removeSavedRoom
} from '../utils/session.js';
import Navbar from '../components/Navbar.jsx';
import Avatar from '../components/Avatar.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const [createdRooms, setCreatedRooms] = useState([]);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'created' | 'joined'
  const [deleteTargetRoomId, setDeleteTargetRoomId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const currentUserId = user?.userId || getUserId();

  // Load rooms from localStorage immediately, then reconcile with server
  async function loadRooms() {
    const localCreatedIds = getSavedCreatedRoomIds();
    const localJoinedIds = getSavedJoinedRoomIds();

    // Initial placeholder state from local storage so user sees rooms instantly
    if (localCreatedIds.length > 0 || localJoinedIds.length > 0) {
      setCreatedRooms((prev) => {
        if (prev.length > 0) return prev;
        return localCreatedIds.map((id) => ({
          roomId: id,
          isAdmin: true,
          password: localStorage.getItem(`lt_room_pwd_${id}`) || '',
          memberCount: 0
        }));
      });
      setJoinedRooms((prev) => {
        if (prev.length > 0) return prev;
        return localJoinedIds.map((id) => ({
          roomId: id,
          isAdmin: false,
          password: localStorage.getItem(`lt_room_pwd_${id}`) || '',
          memberCount: 0
        }));
      });
    }

    try {
      setLoadingRooms(true);
      const data = await fetchUserRooms(currentUserId, localCreatedIds, localJoinedIds);

      const serverCreated = (data?.createdRooms || []).map((r) => ({
        ...r,
        isAdmin: true,
        password: r.password || localStorage.getItem(`lt_room_pwd_${r.roomId}`) || ''
      }));

      const serverJoined = (data?.joinedRooms || []).map((r) => {
        const isLocallyCreated = localCreatedIds.includes(r.roomId);
        return {
          ...r,
          isAdmin: isLocallyCreated || r.isAdmin,
          password: r.password || localStorage.getItem(`lt_room_pwd_${r.roomId}`) || ''
        };
      });

      // Also ensure any locally saved created IDs that weren't returned by backend still appear
      for (const id of localCreatedIds) {
        if (!serverCreated.some((r) => r.roomId === id) && !serverJoined.some((r) => r.roomId === id)) {
          serverCreated.push({
            roomId: id,
            creatorName: user?.name || getSavedName() || 'You',
            isAdmin: true,
            password: localStorage.getItem(`lt_room_pwd_${id}`) || '',
            memberCount: 0
          });
        }
      }

      for (const id of localJoinedIds) {
        if (!serverCreated.some((r) => r.roomId === id) && !serverJoined.some((r) => r.roomId === id)) {
          serverJoined.push({
            roomId: id,
            creatorName: 'Group Host',
            isAdmin: false,
            password: localStorage.getItem(`lt_room_pwd_${id}`) || '',
            memberCount: 0
          });
        }
      }

      const allCreated = [
        ...serverCreated,
        ...serverJoined.filter((r) => r.isAdmin)
      ];
      const allJoined = serverJoined.filter((r) => !r.isAdmin);

      const uniqueCreated = Array.from(new Map(allCreated.map((r) => [r.roomId, r])).values());
      const uniqueJoined = Array.from(new Map(allJoined.map((r) => [r.roomId, r])).values());

      setCreatedRooms(uniqueCreated);
      setJoinedRooms(uniqueJoined);
    } catch {
      // ignore network errors on refresh
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  function handleRejoin(room) {
    const savedName = user?.name || getSavedName() || 'Guest';
    const pwd = room.password || localStorage.getItem(`lt_room_pwd_${room.roomId}`) || sessionStorage.getItem(`lt_room_pwd_${room.roomId}`) || '';
    if (pwd) {
      sessionStorage.setItem(`lt_room_pwd_${room.roomId}`, pwd);
    }
    navigate(`/room/${room.roomId}`, {
      state: {
        name: savedName,
        picture: user?.picture || '',
        password: pwd,
        isCreator: room.isAdmin
      }
    });
  }

  function handleCopyPasskey(passkey) {
    if (!passkey) return;
    navigator.clipboard
      ?.writeText(passkey)
      .then(() => toast.success(`Passkey copied: ${passkey}`))
      .catch(() => toast.error('Could not copy passkey.'));
  }

  async function handleConfirmDelete() {
    if (!deleteTargetRoomId) return;
    setDeleting(true);
    try {
      await deleteRoomApi(deleteTargetRoomId);
      removeSavedRoom(deleteTargetRoomId);
      toast.info('Room permanently deleted from database.');
      setDeleteTargetRoomId(null);
      setCreatedRooms((prev) => prev.filter((r) => r.roomId !== deleteTargetRoomId));
      setJoinedRooms((prev) => prev.filter((r) => r.roomId !== deleteTargetRoomId));
      await loadRooms();
    } catch (err) {
      toast.error(err.message || 'Failed to delete room.');
    } finally {
      setDeleting(false);
    }
  }

  function handleRemoveFromJoined(roomId) {
    removeSavedRoom(roomId);
    setJoinedRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    toast.info('Removed from your joined rooms list.');
  }

  const allDisplayRooms = Array.from(
    new Map([...createdRooms, ...joinedRooms].map((r) => [r.roomId, r])).values()
  );

  const displayedList =
    activeTab === 'created'
      ? createdRooms
      : activeTab === 'joined'
      ? joinedRooms
      : allDisplayRooms;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 max-w-3xl mx-auto w-full">
        {/* Main Hero Card */}
        <div className="w-full text-center animate-slide-up mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 mb-4 shadow-glow">
            <span className="text-2xl">🎧</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-50 mb-2 tracking-tight">
            Listen Together
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-6 leading-relaxed max-w-md mx-auto">
            Watch and listen to YouTube in perfect sync with friends.
          </p>

          {/* Authentication Banner */}
          {isAuthenticated && user ? (
            <div className="card p-3.5 mb-6 flex items-center justify-between gap-3 text-left bg-gradient-to-r from-bg-surface to-bg-elevated border-accent/25 shadow-sm max-w-md mx-auto">
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
              <span className="text-xs text-accent-hover font-medium">Online</span>
            </div>
          ) : (
            <div className="card p-3 mb-6 flex flex-col items-center gap-2 bg-bg-surface/80 max-w-md mx-auto">
              <span className="text-xs text-gray-400 font-medium">
                Sign in with Google to sync your rooms & avatar
              </span>
              <GoogleAuthButton compact={false} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => navigate('/create')}>
              <span>✨</span>
              <span>Create New Room</span>
            </button>
            <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={() => navigate('/join')}>
              <span>🚪</span>
              <span>Join with Passkey</span>
            </button>
          </div>
        </div>

        {/* My Rooms & Groups Section */}
        <div className="w-full card p-5 mb-8 animate-fade-in border-bg-border/80 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-bg-border mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📁</span>
              <h2 className="text-base font-bold text-gray-100">My Rooms & Groups</h2>
            </div>
            <button
              onClick={loadRooms}
              className="text-xs text-gray-400 hover:text-accent flex items-center gap-1 transition"
              title="Refresh rooms"
            >
              <span>🔄</span> Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-elevated text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>🌟 All Rooms</span>
              <span className="text-[10px] bg-black/25 px-1.5 py-0.2 rounded-full">
                {allDisplayRooms.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('created')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'created'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-elevated text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>👑 Created by Me</span>
              <span className="text-[10px] bg-black/25 px-1.5 py-0.2 rounded-full">
                {createdRooms.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('joined')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'joined'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-elevated text-gray-400 hover:text-gray-200'
              }`}
            >
              <span>🚪 Joined Rooms</span>
              <span className="text-[10px] bg-black/25 px-1.5 py-0.2 rounded-full">
                {joinedRooms.length}
              </span>
            </button>
          </div>

          {loadingRooms && displayedList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-xs">Loading your rooms…</p>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="text-center py-8 bg-bg-elevated/40 rounded-xl border border-bg-border/60">
              <span className="text-2xl mb-2 block">✨</span>
              <p className="text-gray-300 text-xs font-semibold mb-1">No rooms found</p>
              <p className="text-gray-500 text-[11px] mb-3">Create your first room and become the Group Admin.</p>
              <button
                onClick={() => navigate('/create')}
                className="btn-secondary !text-xs !py-1.5 !px-3"
              >
                Create a Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedList.map((r) => (
                <div
                  key={r.roomId}
                  className="p-3.5 bg-bg-elevated hover:bg-bg-surface border border-bg-border hover:border-accent/40 rounded-xl transition flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-100 font-mono bg-bg-surface px-1.5 py-0.5 rounded border border-bg-border">
                          {r.roomId}
                        </span>
                        {r.isAdmin ? (
                          <span className="text-[10px] bg-amber-500/15 text-amber-300 font-semibold px-1.5 py-0.2 rounded border border-amber-500/30">
                            👑 Admin
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-500/15 text-blue-300 font-semibold px-1.5 py-0.2 rounded border border-blue-500/30">
                            👥 Member
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.memberCount > 0 ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        {r.memberCount > 0 ? `${r.memberCount} online` : 'Active'}
                      </span>
                    </div>

                    {r.creatorName && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Host: <strong className="text-gray-300">{r.creatorName}</strong>
                      </p>
                    )}

                    {r.password && (
                      <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-bg-surface border border-bg-border/60 my-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[11px]">🔑</span>
                          <span className="text-[11px] font-mono text-gray-300 truncate">
                            {r.password}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPasskey(r.password)}
                          className="text-[10px] text-accent hover:underline flex-shrink-0 font-medium"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    {r.currentVideoTitle && (
                      <p className="text-[11px] text-gray-400 truncate mt-1 flex items-center gap-1">
                        <span>🎵</span>
                        <span className="truncate">{r.currentVideoTitle}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-bg-border/60">
                    <button
                      onClick={() => handleRejoin(r)}
                      className="btn-primary !py-1.5 !px-3 text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <span>▶</span>
                      <span>Rejoin Room</span>
                    </button>

                    {r.isAdmin ? (
                      <button
                        onClick={() => setDeleteTargetRoomId(r.roomId)}
                        className="btn-secondary !py-1.5 !px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-900/40"
                        title="Permanently delete room from database"
                      >
                        <span>🗑️</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveFromJoined(r.roomId)}
                        className="btn-secondary !py-1.5 !px-2 text-xs text-gray-500 hover:text-gray-300"
                        title="Remove from your list"
                      >
                        <span>✕</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 w-full text-left">
          <Feature icon="💬" title="Live chat" desc="Chat with avatars" />
          <Feature icon="🎬" title="Synced playback" desc="Sub-second sync" />
          <Feature icon="📃" title="Shared queue" desc="Collaborative playlist" />
        </div>
      </div>

      {/* Delete Room Modal */}
      {deleteTargetRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="card w-full max-w-sm p-6 border-red-500/30 animate-scale-in">
            <div className="flex items-center gap-2.5 text-red-400 mb-3">
              <span className="text-xl">⚠️</span>
              <h2 className="text-base font-bold text-gray-100">Delete Room from Database?</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Are you sure you want to permanently delete room <strong className="text-gray-200">{deleteTargetRoomId}</strong> from the database? All queue and chat history will be permanently erased.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetRoomId(null)}
                className="btn-secondary !py-1.5 !px-3 text-xs"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="btn-primary !bg-red-600 hover:!bg-red-500 !py-1.5 !px-4 text-xs"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete from Database'}
              </button>
            </div>
          </div>
        </div>
      )}

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
