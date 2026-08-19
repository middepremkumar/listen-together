const roomManager = require('./roomManager');
const { SocketRateLimiter } = require('../middleware/rateLimiter');
const {
  isValidRoomCode,
  isValidName,
  sanitizeName,
  isValidMessage,
  sanitizeMessage,
  extractYouTubeId
} = require('../utils/validators');

const DISCONNECT_GRACE_MS = 20 * 1000;
const HEARTBEAT_INTERVAL_MS = 4000;

const disconnectTimers = new Map(); // `${roomId}:${userId}` -> timeout handle

function systemMessage(room, text) {
  const msg = {
    id: roomManager.generateId(),
    type: 'system',
    sender: 'System',
    text,
    timestamp: Date.now()
  };
  roomManager.addChatMessage(room, msg);
  return msg;
}

function requireHost(io, socket, room) {
  const userId = socket.data.userId;
  if (!roomManager.isHost(room, userId)) {
    socket.emit('room:error', { message: 'Only the host can perform this action.' });
    return false;
  }
  return true;
}

async function fetchYouTubeMetadata(videoId) {
  // Uses YouTube's public oEmbed endpoint - no API key required, no scraping,
  // no bypassing of restrictions. If it fails, we fall back to minimal metadata.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`oEmbed status ${res.status}`);
    const data = await res.json();
    return {
      title: data.title || 'Untitled video',
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0
    };
  } catch (err) {
    return {
      title: 'YouTube video',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0
    };
  }
}

function initSocket(io) {
  const limiter = new SocketRateLimiter();

  io.on('connection', (socket) => {
    socket.data.userId = null;
    socket.data.userId = null;
    socket.data.roomId = null;
    socket.data.name = null;
    socket.data.picture = null;

    // ---------- JOIN ROOM ----------
    socket.on('room:join', async ({ roomId, userId, name, picture, password } = {}, ack) => {
      try {
        if (typeof ack !== 'function') ack = () => {};

        if (!userId || typeof userId !== 'string' || userId.length > 64) {
          return ack({ ok: false, error: 'Invalid session. Please refresh and try again.' });
        }
        if (!isValidName(name)) {
          return ack({ ok: false, error: 'Please enter a display name (1-24 characters).' });
        }

        let room = null;
        if (roomId && isValidRoomCode(roomId)) {
          room = await roomManager.getOrLoadRoom(roomId);
        } else if (password && typeof password === 'string' && password.trim()) {
          room = await roomManager.getOrLoadRoomByPassword(password.trim());
        }

        if (!room) {
          return ack({ ok: false, error: 'Room not found. Check the code or password and try again.' });
        }

        const cleanName = sanitizeName(name);
        const existingMember = room.members.get(userId);
        const connectedCount = Array.from(room.members.values()).filter((m) => m.connected).length;

        if (!existingMember && room.settings.locked) {
          return ack({ ok: false, error: 'This room is locked by the host.' });
        }

        if (!existingMember && connectedCount >= room.settings.maxMembers) {
          return ack({ ok: false, error: 'This room is full.' });
        }

        // Check password if set and user is not an existing connected member
        if (!existingMember && room.settings.password) {
          const isRoomHost = room.hostUserId === userId;
          if (!isRoomHost && !roomManager.verifyPassword(room, password)) {
            return ack({ ok: false, error: 'Incorrect room password.', requiresPassword: true });
          }
        }

        // Prevent duplicate display names among currently connected members
        const nameTaken = Array.from(room.members.values()).some(
          (m) => m.connected && m.userId !== userId && m.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (nameTaken) {
          return ack({ ok: false, error: 'That display name is already taken in this room.' });
        }

        // Cancel any pending purge timer (user is reconnecting)
        const timerKey = `${roomId}:${userId}`;
        if (disconnectTimers.has(timerKey)) {
          clearTimeout(disconnectTimers.get(timerKey));
          disconnectTimers.delete(timerKey);
        }

        const wasNewMember = !existingMember;
        const userPic = typeof picture === 'string' ? picture : '';
        roomManager.addMember(room, { userId, name: cleanName, picture: userPic, socketId: socket.id });

        socket.data.userId = userId;
        socket.data.roomId = room.roomId;
        socket.data.name = cleanName;
        socket.data.picture = userPic;
        socket.join(room.roomId);

        ack({ ok: true, state: roomManager.serializeRoom(room) });

        if (wasNewMember) {
          const msg = systemMessage(room, `${cleanName} joined the room`);
          io.to(room.roomId).emit('chat:message', msg);
        }

        io.to(room.roomId).emit('room:members', roomManager.serializeMembers(room));
        io.to(room.roomId).emit('host:changed', { hostUserId: room.hostUserId });

        roomManager.persistRoom(room);
      } catch (err) {
        console.error('[socket room:join]', err);
        ack({ ok: false, error: 'Failed to join room. Please try again.' });
      }
    });

    // ---------- REQUEST FRESH STATE (used after reconnect) ----------
    socket.on('room:requestState', async (_payload, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room) return ack({ ok: false, error: 'Room not found.' });
      ack({ ok: true, state: roomManager.serializeRoom(room) });
    });

    // ---------- CHAT ----------
    socket.on('chat:send', ({ text } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !socket.data.userId) return;

      if (!limiter.allow(`chat:${socket.id}`, 8, 10 * 1000)) {
        socket.emit('room:error', { message: 'You are sending messages too quickly.' });
        return;
      }

      if (!isValidMessage(text)) {
        socket.emit('room:error', { message: 'Message must be between 1 and 500 characters.' });
        return;
      }

      const msg = {
        id: roomManager.generateId(),
        type: 'chat',
        sender: socket.data.name,
        senderId: socket.data.userId,
        senderPicture: socket.data.picture || '',
        text: sanitizeMessage(text),
        timestamp: Date.now()
      };

      roomManager.addChatMessage(room, msg);
      io.to(room.roomId).emit('chat:message', msg);
    });

    // ---------- PLAYBACK CONTROL (host only) ----------
    socket.on('playback:play', ({ position } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;

      room.currentVideo.isPlaying = true;
      if (typeof position === 'number' && position >= 0) {
        room.currentVideo.position = position;
      }
      room.currentVideo.updatedAt = Date.now();
      roomManager.touch(room);

      socket.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'play' });
    });

    socket.on('playback:pause', ({ position } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;

      room.currentVideo.isPlaying = false;
      if (typeof position === 'number' && position >= 0) {
        room.currentVideo.position = position;
      }
      room.currentVideo.updatedAt = Date.now();
      roomManager.touch(room);

      socket.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'pause' });
    });

    socket.on('playback:seek', ({ position } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      if (typeof position !== 'number' || position < 0) return;

      room.currentVideo.position = position;
      room.currentVideo.updatedAt = Date.now();
      roomManager.touch(room);

      socket.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'seek' });
    });

    // Host emits this periodically; used to correct drift on other clients.
    socket.on('playback:heartbeat', ({ position, isPlaying } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !roomManager.isHost(room, socket.data.userId)) return;
      if (typeof position !== 'number') return;

      room.currentVideo.position = position;
      room.currentVideo.isPlaying = !!isPlaying;
      room.currentVideo.updatedAt = Date.now();

      socket.to(room.roomId).emit('playback:correction', {
        position,
        isPlaying: !!isPlaying,
        updatedAt: room.currentVideo.updatedAt
      });
    });

    // ---------- VIDEO / QUEUE ----------
    socket.on('queue:add', async ({ url } = {}, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !socket.data.userId) return ack({ ok: false, error: 'Not in a room.' });

      if (!limiter.allow(`queueAdd:${socket.id}`, 10, 30 * 1000)) {
        return ack({ ok: false, error: 'You are adding videos too quickly.' });
      }

      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return ack({ ok: false, error: 'That does not look like a valid YouTube URL.' });
      }

      const meta = await fetchYouTubeMetadata(videoId);
      const item = {
        id: roomManager.generateId(),
        videoId,
        title: meta.title,
        thumbnail: meta.thumbnail,
        duration: meta.duration,
        addedBy: socket.data.name,
        addedByUserId: socket.data.userId,
        addedByPicture: socket.data.picture || '',
        addedAt: Date.now()
      };

      const added = roomManager.addToQueue(room, item);
      if (!added) {
        return ack({ ok: false, error: 'Queue is full.' });
      }

      // If nothing is currently playing, start this item immediately.
      if (!room.currentVideo.videoId) {
        roomManager.playNextInQueue(room);
        io.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'auto-start' });
      }

      io.to(room.roomId).emit('queue:update', room.queue);
      const msg = systemMessage(room, `${socket.data.name} added "${item.title}" to the queue`);
      io.to(room.roomId).emit('chat:message', msg);
      ack({ ok: true, item });
    });

    socket.on('queue:remove', ({ itemId } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      if (roomManager.removeFromQueue(room, itemId)) {
        io.to(room.roomId).emit('queue:update', room.queue);
      }
    });

    socket.on('queue:reorder', ({ orderedIds } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      if (!Array.isArray(orderedIds)) return;
      roomManager.reorderQueue(room, orderedIds);
      io.to(room.roomId).emit('queue:update', room.queue);
    });

    socket.on('queue:clear', () => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      roomManager.clearQueue(room);
      io.to(room.roomId).emit('queue:update', room.queue);
    });

    function advanceToNext(room) {
      const next = roomManager.playNextInQueue(room);
      io.to(room.roomId).emit('queue:update', room.queue);
      if (next) {
        io.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'next' });
      } else {
        room.currentVideo = {
          videoId: null,
          title: '',
          thumbnail: '',
          duration: 0,
          position: 0,
          isPlaying: false,
          updatedAt: Date.now()
        };
        io.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'queue-empty' });
      }
      return next;
    }

    socket.on('queue:playNext', () => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      advanceToNext(room);
    });

    socket.on('video:ended', () => {
      const room = roomManager.getRoom(socket.data.roomId);
      // Only the host's "ended" event actually advances the room, to avoid
      // out-of-sync clients skipping the video early for everyone.
      if (!room || !roomManager.isHost(room, socket.data.userId)) return;
      advanceToNext(room);
    });

    socket.on('video:change', async ({ url } = {}, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return ack({ ok: false, error: 'Only the host can change the video.' });

      const videoId = extractYouTubeId(url);
      if (!videoId) return ack({ ok: false, error: 'That does not look like a valid YouTube URL.' });

      const meta = await fetchYouTubeMetadata(videoId);
      roomManager.setCurrentVideo(room, { videoId, ...meta });

      io.to(room.roomId).emit('playback:update', { ...room.currentVideo, reason: 'change' });
      const msg = systemMessage(room, `${socket.data.name} changed the video`);
      io.to(room.roomId).emit('chat:message', msg);
      ack({ ok: true });
    });

    // ---------- HOST ACTIONS ----------
    socket.on('room:lock', ({ locked } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      room.settings.locked = !!locked;
      roomManager.touch(room);
      io.to(room.roomId).emit('room:locked', { locked: room.settings.locked });
    });

    socket.on('room:setPassword', async ({ password } = {}, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) {
        return ack({ ok: false, error: 'Only the host can set the room password.' });
      }

      const cleanPassword = typeof password === 'string' && password.trim() ? password.trim() : null;
      if (cleanPassword) {
        if (cleanPassword.length < 3) {
          return ack({ ok: false, error: 'Room password must be at least 3 characters long.' });
        }
        const isUnique = await roomManager.isPasswordUnique(cleanPassword, room.roomId);
        if (!isUnique) {
          return ack({ ok: false, error: 'That password is already in use by another room.' });
        }
      }

      const hasPassword = roomManager.setPassword(room, cleanPassword);
      io.to(room.roomId).emit('room:settingsUpdated', {
        settings: {
          locked: room.settings.locked,
          maxMembers: room.settings.maxMembers,
          hasPassword
        }
      });

      const msg = systemMessage(
        room,
        hasPassword ? `${socket.data.name} set a room password` : `${socket.data.name} removed the room password`
      );
      io.to(room.roomId).emit('chat:message', msg);
      ack({ ok: true, hasPassword });
    });

    socket.on('room:delete', async (_payload, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) {
        return ack({ ok: false, error: 'Only the host can permanently delete this room.' });
      }

      const roomId = room.roomId;
      io.to(roomId).emit('room:deleted', { message: 'The host has permanently deleted this room.' });

      const roomSockets = await io.in(roomId).fetchSockets();
      for (const s of roomSockets) {
        s.leave(roomId);
        s.data.roomId = null;
      }

      await roomManager.deleteRoomCompletely(roomId);
      ack({ ok: true });
    });

    socket.on('host:transfer', ({ userId: targetId } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;

      const target = room.members.get(targetId);
      if (!target || !target.connected) {
        socket.emit('room:error', { message: 'That member is not available.' });
        return;
      }

      for (const m of room.members.values()) {
        m.isHost = m.userId === targetId;
      }
      room.hostUserId = targetId;
      roomManager.touch(room);

      io.to(room.roomId).emit('host:changed', { hostUserId: room.hostUserId });
      io.to(room.roomId).emit('room:members', roomManager.serializeMembers(room));
      const msg = systemMessage(room, `${target.name} is now the host`);
      io.to(room.roomId).emit('chat:message', msg);
    });

    socket.on('host:kick', ({ userId: targetId } = {}) => {
      const room = roomManager.getRoom(socket.data.roomId);
      if (!room || !requireHost(io, socket, room)) return;
      if (targetId === socket.data.userId) return;

      const target = room.members.get(targetId);
      if (!target) return;

      for (const sId of target.sockets) {
        io.sockets.sockets.get(sId)?.emit('room:kicked');
        io.sockets.sockets.get(sId)?.leave(room.roomId);
      }

      const name = target.name;
      room.members.delete(targetId);
      if (room.hostUserId === targetId) {
        room.hostUserId = null;
        const next = Array.from(room.members.values()).find((m) => m.connected);
        if (next) {
          next.isHost = true;
          room.hostUserId = next.userId;
        }
      }
      roomManager.touch(room);

      io.to(room.roomId).emit('room:members', roomManager.serializeMembers(room));
      io.to(room.roomId).emit('host:changed', { hostUserId: room.hostUserId });
      const msg = systemMessage(room, `${name} was removed from the room`);
      io.to(room.roomId).emit('chat:message', msg);
    });

    // ---------- LEAVE / DISCONNECT ----------
    function handleLeave(reason) {
      const { roomId, userId, name } = socket.data;
      if (!roomId || !userId) return;

      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const { member } = roomManager.removeSocketFromMember(room, userId, socket.id);
      if (!member) return;

      io.to(roomId).emit('room:members', roomManager.serializeMembers(room));

      if (member.connected) {
        // User still has other active sockets/tabs open - don't announce leave.
        return;
      }

      const timerKey = `${roomId}:${userId}`;
      const timer = setTimeout(async () => {
        disconnectTimers.delete(timerKey);
        const currentRoom = roomManager.getRoom(roomId);
        if (!currentRoom) return;
        const stillThere = currentRoom.members.get(userId);
        if (!stillThere || stillThere.connected) return; // reconnected in the meantime

        const wasHost = currentRoom.hostUserId === userId;
        roomManager.purgeDisconnectedMember(currentRoom, userId);

        io.to(roomId).emit('room:members', roomManager.serializeMembers(currentRoom));
        const msg = systemMessage(currentRoom, `${name} left the room`);
        io.to(roomId).emit('chat:message', msg);

        if (wasHost) {
          io.to(roomId).emit('host:changed', { hostUserId: currentRoom.hostUserId });
          if (currentRoom.hostUserId) {
            const newHost = currentRoom.members.get(currentRoom.hostUserId);
            const hostMsg = systemMessage(currentRoom, `${newHost.name} is now the host`);
            io.to(roomId).emit('chat:message', hostMsg);
          }
        }

        roomManager.persistRoom(currentRoom);
      }, DISCONNECT_GRACE_MS);

      disconnectTimers.set(timerKey, timer);
      roomManager.persistRoom(room);
    }

    socket.on('room:leave', () => {
      handleLeave('explicit');
      socket.leave(socket.data.roomId);
      socket.data.roomId = null;
    });

    socket.on('disconnect', () => {
      handleLeave('disconnect');
    });
  });

  // Periodic housekeeping: prune empty/stale rooms, persist active rooms.
  setInterval(() => {
    roomManager.pruneEmptyRooms();
  }, 5 * 60 * 1000);

  setInterval(() => {
    roomManager.persistAllRooms();
  }, 60 * 1000);
}

module.exports = { initSocket };
