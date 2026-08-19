const Room = require('../models/Room');
const { isDbConnected } = require('../config/db');
const { generateRoomCode } = require('../utils/roomCode');
const { nanoid } = require('nanoid');

// In-memory map of active rooms: roomId -> roomState
// This is the source of truth for real-time playback sync (fast, no DB round trips).
// Mongo is used for persistence / recovery across server restarts.
const rooms = new Map();

const MAX_ROOM_MEMBERS = parseInt(process.env.MAX_ROOM_MEMBERS, 10) || 25;
const MAX_CHAT_HISTORY = 100;
const MAX_QUEUE_SIZE = 100;

function newRoomState(roomId) {
  return {
    roomId,
    hostUserId: null,
    members: new Map(), // userId -> { userId, name, isHost, sockets: Set<socketId>, connected }
    queue: [],
    currentVideo: {
      videoId: null,
      title: '',
      thumbnail: '',
      duration: 0,
      position: 0,
      isPlaying: false,
      updatedAt: Date.now()
    },
    settings: {
      locked: false,
      maxMembers: MAX_ROOM_MEMBERS
    },
    chatHistory: [],
    lastActivity: Date.now(),
    createdAt: Date.now()
  };
}

async function createRoom() {
  let roomId;
  let attempts = 0;
  do {
    roomId = generateRoomCode();
    attempts += 1;
  } while (rooms.has(roomId) && attempts < 10);

  const state = newRoomState(roomId);
  rooms.set(roomId, state);

  if (isDbConnected()) {
    try {
      await Room.create({ roomId, members: [], queue: [], chatHistory: [] });
    } catch (err) {
      console.error('[roomManager] Failed to persist new room:', err.message);
    }
  }

  return state;
}

function getRoom(roomId) {
  if (!roomId) return null;
  return rooms.get(roomId.toUpperCase()) || null;
}

async function loadRoomFromDb(roomId) {
  if (!isDbConnected()) return null;
  try {
    const doc = await Room.findOne({ roomId: roomId.toUpperCase() }).lean();
    if (!doc) return null;

    const state = newRoomState(doc.roomId);
    state.hostUserId = doc.hostUserId || null;
    state.queue = doc.queue || [];
    state.currentVideo = {
      ...state.currentVideo,
      ...doc.currentVideo,
      isPlaying: false, // never resume auto-playing on reload
      updatedAt: Date.now()
    };
    state.settings = { ...state.settings, ...doc.settings };
    state.chatHistory = doc.chatHistory || [];
    state.lastActivity = Date.now();

    // Members are NOT restored as connected - they must rejoin via socket.
    rooms.set(state.roomId, state);
    return state;
  } catch (err) {
    console.error('[roomManager] Failed to load room from DB:', err.message);
    return null;
  }
}

async function getOrLoadRoom(roomId) {
  if (!roomId) return null;
  const upper = roomId.toUpperCase();
  return rooms.get(upper) || (await loadRoomFromDb(upper));
}

function touch(room) {
  room.lastActivity = Date.now();
}

function serializeMembers(room) {
  return Array.from(room.members.values()).map((m) => ({
    userId: m.userId,
    name: m.name,
    picture: m.picture || '',
    isHost: m.isHost,
    connected: m.connected
  }));
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    hostUserId: room.hostUserId,
    members: serializeMembers(room),
    queue: room.queue,
    currentVideo: room.currentVideo,
    settings: room.settings,
    chatHistory: room.chatHistory.slice(-50)
  };
}

function addMember(room, { userId, name, picture, socketId }) {
  let member = room.members.get(userId);

  if (member) {
    member.sockets.add(socketId);
    member.connected = true;
    member.name = name || member.name;
    if (picture) member.picture = picture;
  } else {
    member = {
      userId,
      name,
      picture: picture || '',
      isHost: false,
      sockets: new Set([socketId]),
      connected: true
    };
    room.members.set(userId, member);
  }

  // Assign host if room has no host, or previous host is gone
  const hostStillPresent = room.hostUserId && room.members.has(room.hostUserId);
  if (!hostStillPresent) {
    room.hostUserId = userId;
    for (const m of room.members.values()) {
      m.isHost = m.userId === userId;
    }
  }

  touch(room);
  return member;
}

function removeSocketFromMember(room, userId, socketId) {
  const member = room.members.get(userId);
  if (!member) return { removed: false };

  member.sockets.delete(socketId);

  if (member.sockets.size === 0) {
    member.connected = false;
  }

  touch(room);
  return { removed: true, member };
}

function purgeDisconnectedMember(room, userId) {
  const member = room.members.get(userId);
  if (!member || member.connected) return false;
  room.members.delete(userId);

  if (room.hostUserId === userId) {
    room.hostUserId = null;
    const next = Array.from(room.members.values()).find((m) => m.connected);
    if (next) {
      next.isHost = true;
      room.hostUserId = next.userId;
    }
  }

  touch(room);
  return true;
}

function isHost(room, userId) {
  return room.hostUserId === userId;
}

function addChatMessage(room, message) {
  room.chatHistory.push(message);
  if (room.chatHistory.length > MAX_CHAT_HISTORY) {
    room.chatHistory.shift();
  }
  touch(room);
}

function addToQueue(room, item) {
  if (room.queue.length >= MAX_QUEUE_SIZE) {
    return false;
  }
  room.queue.push(item);
  touch(room);
  return true;
}

function removeFromQueue(room, itemId) {
  const idx = room.queue.findIndex((q) => q.id === itemId);
  if (idx === -1) return false;
  room.queue.splice(idx, 1);
  touch(room);
  return true;
}

function reorderQueue(room, orderedIds) {
  const map = new Map(room.queue.map((q) => [q.id, q]));
  const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);
  // Keep any items not included in orderedIds (safety) at the end
  const remaining = room.queue.filter((q) => !orderedIds.includes(q.id));
  room.queue = [...reordered, ...remaining];
  touch(room);
}

function clearQueue(room) {
  room.queue = [];
  touch(room);
}

function playNextInQueue(room) {
  const next = room.queue.shift();
  if (!next) return null;
  room.currentVideo = {
    videoId: next.videoId,
    title: next.title,
    thumbnail: next.thumbnail,
    duration: next.duration,
    position: 0,
    isPlaying: true,
    updatedAt: Date.now()
  };
  touch(room);
  return next;
}

function setCurrentVideo(room, item) {
  room.currentVideo = {
    videoId: item.videoId,
    title: item.title || '',
    thumbnail: item.thumbnail || '',
    duration: item.duration || 0,
    position: 0,
    isPlaying: true,
    updatedAt: Date.now()
  };
  touch(room);
}

function generateId() {
  return nanoid(10);
}

// Periodically persist active rooms to MongoDB (best-effort, non-blocking).
async function persistRoom(room) {
  if (!isDbConnected()) return;
  try {
    await Room.findOneAndUpdate(
      { roomId: room.roomId },
      {
        roomId: room.roomId,
        hostUserId: room.hostUserId,
        members: serializeMembers(room),
        queue: room.queue,
        currentVideo: room.currentVideo,
        settings: room.settings,
        chatHistory: room.chatHistory.slice(-100),
        lastActivity: new Date(room.lastActivity)
      },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[roomManager] Failed to persist room ${room.roomId}:`, err.message);
  }
}

async function persistAllRooms() {
  const tasks = Array.from(rooms.values()).map(persistRoom);
  await Promise.allSettled(tasks);
}

function deleteRoom(roomId) {
  rooms.delete(roomId);
}

// Clean up rooms with no connected members and no recent activity.
function pruneEmptyRooms() {
  const inactivityMs = (parseInt(process.env.ROOM_INACTIVITY_MINUTES, 10) || 180) * 60 * 1000;
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    const hasConnected = Array.from(room.members.values()).some((m) => m.connected);
    const stale = now - room.lastActivity > inactivityMs;
    if (!hasConnected && stale) {
      rooms.delete(roomId);
    }
  }
}

function getActiveRoomCount() {
  return rooms.size;
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  getOrLoadRoom,
  loadRoomFromDb,
  serializeRoom,
  serializeMembers,
  addMember,
  removeSocketFromMember,
  purgeDisconnectedMember,
  isHost,
  addChatMessage,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  clearQueue,
  playNextInQueue,
  setCurrentVideo,
  generateId,
  persistRoom,
  persistAllRooms,
  deleteRoom,
  pruneEmptyRooms,
  getActiveRoomCount,
  touch,
  MAX_ROOM_MEMBERS
};
