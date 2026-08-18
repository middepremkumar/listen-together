import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocketContext } from '../context/SocketContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getUserId, getSavedName, saveName } from '../utils/session.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import Chat from '../components/Chat.jsx';
import Queue from '../components/Queue.jsx';
import MembersList from '../components/MembersList.jsx';
import RoomControls from '../components/RoomControls.jsx';
import ErrorPage from './ErrorPage.jsx';

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'queue', label: 'Queue', icon: '📃' },
  { id: 'members', label: 'People', icon: '👥' }
];

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, connectionState } = useSocketContext();
  const toast = useToast();

  const userId = useRef(getUserId()).current;
  const [displayName] = useState(location.state?.name || getSavedName());

  const [joinState, setJoinState] = useState('joining'); // joining | joined | error | kicked
  const [joinError, setJoinError] = useState('');

  const [members, setMembers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentVideo, setCurrentVideo] = useState({
    videoId: null,
    title: '',
    isPlaying: false,
    position: 0
  });
  const [locked, setLocked] = useState(false);
  const [hostUserId, setHostUserId] = useState(null);
  const [syncSignal, setSyncSignal] = useState(0);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  const isHost = hostUserId === userId;

  // Redirect to the join form if we don't have a name yet (e.g. opened invite link directly)
  useEffect(() => {
    if (!displayName) {
      navigate(`/join/${roomId}`, { replace: true });
    }
  }, [displayName, roomId, navigate]);

  const joinRoom = useCallback(() => {
    if (!displayName) return;
    setJoinState('joining');
    socket.emit('room:join', { roomId, userId, name: displayName }, (res) => {
      if (!res?.ok) {
        setJoinState('error');
        setJoinError(res?.error || 'Failed to join room.');
        return;
      }
      saveName(displayName);
      applyState(res.state);
      setJoinState('joined');
    });
  }, [displayName, roomId, socket, userId]);

  function applyState(state) {
    setMembers(state.members);
    setQueue(state.queue);
    setChatMessages(state.chatHistory);
    setCurrentVideo(state.currentVideo);
    setLocked(state.settings.locked);
    setHostUserId(state.hostUserId);
    setSyncSignal((s) => s + 1);
  }

  // Initial join
  useEffect(() => {
    if (!displayName) return;
    joinRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  // Re-join / re-sync automatically after a reconnect
  const wasDisconnected = useRef(false);
  useEffect(() => {
    if (connectionState === 'disconnected' || connectionState === 'reconnecting') {
      wasDisconnected.current = true;
    } else if (connectionState === 'connected' && wasDisconnected.current && displayName) {
      wasDisconnected.current = false;
      joinRoom();
      toast.info('Reconnected — syncing room state…');
    }
  }, [connectionState, displayName, joinRoom, toast]);

  // Socket event subscriptions
  useEffect(() => {
    function onMembers(list) {
      setMembers(list);
    }
    function onChatMessage(msg) {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
    }
    function onPlaybackUpdate(update) {
      setCurrentVideo({
        videoId: update.videoId,
        title: update.title,
        thumbnail: update.thumbnail,
        isPlaying: update.isPlaying,
        position: update.position
      });
      setSyncSignal((s) => s + 1);
    }
    function onPlaybackCorrection(update) {
      setCurrentVideo((prev) => ({ ...prev, isPlaying: update.isPlaying, position: update.position }));
      setSyncSignal((s) => s + 1);
    }
    function onQueueUpdate(newQueue) {
      setQueue(newQueue);
    }
    function onHostChanged({ hostUserId: newHost }) {
      setHostUserId(newHost);
    }
    function onRoomLocked({ locked: newLocked }) {
      setLocked(newLocked);
    }
    function onRoomError({ message }) {
      toast.error(message);
    }
    function onKicked() {
      setJoinState('kicked');
    }

    socket.on('room:members', onMembers);
    socket.on('chat:message', onChatMessage);
    socket.on('playback:update', onPlaybackUpdate);
    socket.on('playback:correction', onPlaybackCorrection);
    socket.on('queue:update', onQueueUpdate);
    socket.on('host:changed', onHostChanged);
    socket.on('room:locked', onRoomLocked);
    socket.on('room:error', onRoomError);
    socket.on('room:kicked', onKicked);

    return () => {
      socket.off('room:members', onMembers);
      socket.off('chat:message', onChatMessage);
      socket.off('playback:update', onPlaybackUpdate);
      socket.off('playback:correction', onPlaybackCorrection);
      socket.off('queue:update', onQueueUpdate);
      socket.off('host:changed', onHostChanged);
      socket.off('room:locked', onRoomLocked);
      socket.off('room:error', onRoomError);
      socket.off('room:kicked', onKicked);
    };
  }, [socket, toast]);

  // Leave on unmount / tab close
  useEffect(() => {
    function handleBeforeUnload() {
      socket.emit('room:leave');
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket]);

  function handleLeave() {
    socket.emit('room:leave');
    navigate('/');
  }

  function handleCopyLink() {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard
      ?.writeText(link)
      .then(() => toast.success('Invite link copied!'))
      .catch(() => toast.error('Could not copy link.'));
  }

  function handleToggleLock() {
    socket.emit('room:lock', { locked: !locked });
  }

  function handleSendChat(text) {
    socket.emit('chat:send', { text });
  }

  function handleAddToQueue(url, cb) {
    setAddingToQueue(true);
    socket.emit('queue:add', { url }, (res) => {
      setAddingToQueue(false);
      cb(res?.ok ? null : res?.error || 'Failed to add video.');
    });
  }

  function handleRemoveFromQueue(itemId) {
    socket.emit('queue:remove', { itemId });
  }

  function handleClearQueue() {
    socket.emit('queue:clear');
  }

  function handlePlayNext() {
    socket.emit('queue:playNext');
  }

  function handleKick(targetUserId) {
    socket.emit('host:kick', { userId: targetUserId });
  }

  function handleTransferHost(targetUserId) {
    socket.emit('host:transfer', { userId: targetUserId });
  }

  if (joinState === 'error') {
    return (
      <ErrorPage
        icon="🚫"
        title="Couldn't join room"
        message={joinError}
        actionLabel="Back to home"
      />
    );
  }

  if (joinState === 'kicked') {
    return (
      <ErrorPage
        icon="👋"
        title="You were removed"
        message="The host removed you from this room."
        actionLabel="Back to home"
      />
    );
  }

  if (joinState === 'joining') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-gray-500 text-sm animate-pulse">Joining room…</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      <RoomControls
        roomId={roomId}
        connectionState={connectionState}
        isHost={isHost}
        locked={locked}
        onCopyLink={handleCopyLink}
        onToggleLock={handleToggleLock}
        onLeave={handleLeave}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Main video area */}
        <div className="flex-1 flex flex-col p-4 min-h-0 overflow-y-auto">
          <VideoPlayer
            videoId={currentVideo.videoId}
            isPlaying={currentVideo.isPlaying}
            isHost={isHost}
            syncSignal={syncSignal}
            syncPosition={currentVideo.position}
            onPlay={(pos) => socket.emit('playback:play', { position: pos })}
            onPause={(pos) => socket.emit('playback:pause', { position: pos })}
            onSeek={(pos) => socket.emit('playback:seek', { position: pos })}
            onEnded={() => socket.emit('video:ended')}
            onHeartbeat={(pos, playing) => socket.emit('playback:heartbeat', { position: pos, isPlaying: playing })}
          />
          <div className="mt-4">
            <h2 className="text-lg font-bold text-gray-100 truncate">
              {currentVideo.title || 'Nothing playing'}
            </h2>
            {!isHost && currentVideo.videoId && (
              <p className="text-xs text-gray-500 mt-1">
                Playback is controlled by the host. Your view stays in sync automatically.
              </p>
            )}
          </div>
        </div>

        {/* Side panel: tabbed on both mobile (bottom sheet) and desktop (right rail) */}
        <div className="lg:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-bg-border flex flex-col min-h-0 h-[48vh] lg:h-auto">
          <div className="flex border-b border-bg-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 ${
                  activeTab === tab.id ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {activeTab === 'chat' && (
              <Chat messages={chatMessages} onSend={handleSendChat} currentUserId={userId} />
            )}
            {activeTab === 'queue' && (
              <Queue
                queue={queue}
                isHost={isHost}
                onAdd={handleAddToQueue}
                onRemove={handleRemoveFromQueue}
                onClear={handleClearQueue}
                onPlayNext={handlePlayNext}
                adding={addingToQueue}
              />
            )}
            {activeTab === 'members' && (
              <MembersList
                members={members}
                currentUserId={userId}
                isHost={isHost}
                onKick={handleKick}
                onTransferHost={handleTransferHost}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
