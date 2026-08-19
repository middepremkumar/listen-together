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
    creatorUserId: null,
    creatorName: '',
    hostUserId: null,
    members: new Map(), // userId -> { userId, name, isHost, isAdmin, sockets: Set<socketId>, connected }
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
      maxMembers: MAX_ROOM_MEMBERS,
      hasPassword: true,
      password: null
    },
    chatHistory: [],
    lastActivity: Date.now(),
    createdAt: Date.now()
  };
}

async function createRoom(options = {}) {
  let roomId;
  let attempts = 0;
  do {
    roomId = generateRoomCode();
    attempts += 1;
  } while (rooms.has(roomId) && attempts < 10);

  const state = newRoomState(roomId);
  const password = typeof options.password === 'string' && options.password.trim() ? options.password.trim() : null;
  if (password) {
    state.settings.password = password;
    state.settings.hasPassword = true;
  }

  if (options.hostUserId) {
    state.creatorUserId = options.hostUserId;
    state.hostUserId = options.hostUserId;
  }
  if (options.hostName) {
    state.creatorName = options.hostName;
  }

  rooms.set(roomId, state);

  if (isDbConnected()) {
    try {
      await Room.create({
        roomId,
        creatorUserId: state.creatorUserId,
        creatorName: state.creatorName,
        hostUserId: state.hostUserId,
        members: [],
        queue: [],
        chatHistory: [],
        settings: state.settings
      });
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
    state.creatorUserId = doc.creatorUserId || doc.hostUserId || null;
    state.creatorName = doc.creatorName || '';
    state.hostUserId = doc.hostUserId || state.creatorUserId || null;
    state.queue = doc.queue || [];
    state.currentVideo = {
      ...state.currentVideo,
      ...doc.currentVideo,
      isPlaying: false, // never resume auto-playing on reload
      updatedAt: Date.now()
    };
    state.settings = {
      ...state.settings,
      ...doc.settings,
      hasPassword: !!(doc.settings && doc.settings.password),
      password: doc.settings?.password || null
    };
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
    isAdmin: m.userId === room.creatorUserId,
    connected: m.connected
  }));
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    creatorUserId: room.creatorUserId,
    creatorName: room.creatorName,
    hostUserId: room.hostUserId,
    members: serializeMembers(room),
    queue: room.queue,
    currentVideo: room.currentVideo,
    settings: {
      locked: !!room.settings.locked,
      maxMembers: room.settings.maxMembers || MAX_ROOM_MEMBERS,
      hasPassword: !!room.settings.password
    },
    chatHistory: room.chatHistory.slice(-50)
  };
}

function addMember(room, { userId, name, picture, socketId }) {
  // If room doesn't have a creator assigned yet, this first joining user becomes the permanent Group Admin
  if (!room.creatorUserId) {
    room.creatorUserId = userId;
    room.creatorName = name;
  }

  const isCreator = room.creatorUserId === userId;
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
      isAdmin: isCreator,
      sockets: new Set([socketId]),
      connected: true
    };
    room.members.set(userId, member);
  }

  // If the returning/joining user is the permanent Group Admin, automatically restore Host privileges
  if (isCreator) {
    room.hostUserId = userId;
    for (const m of room.members.values()) {
      m.isHost = m.userId === userId;
    }
  } else {
    // If no active connected host is currently in the room, assign this member
    const activeHost = room.hostUserId && room.members.get(room.hostUserId)?.connected;
    if (!activeHost) {
      room.hostUserId = userId;
      for (const m of room.members.values()) {
        m.isHost = m.userId === userId;
      }
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

function setPassword(room, password) {
  const clean = typeof password === 'string' && password.trim() ? password.trim() : null;
  room.settings.password = clean;
  room.settings.hasPassword = !!clean;
  touch(room);
  persistRoom(room);
  return room.settings.hasPassword;
}

function verifyPassword(room, inputPassword) {
  if (!room.settings.password) return true;
  if (!inputPassword || typeof inputPassword !== 'string') return false;
  return room.settings.password === inputPassword.trim();
}

async function isPasswordUnique(password, excludeRoomId = null) {
  if (!password || typeof password !== 'string') return true;
  const clean = password.trim().toLowerCase();

  // Check memory cache
  for (const [rId, room] of rooms.entries()) {
    if (excludeRoomId && rId === excludeRoomId.toUpperCase()) continue;
    if (room.settings.password && room.settings.password.toLowerCase() === clean) {
      return false;
    }
  }

  // Check MongoDB
  if (isDbConnected()) {
    try {
      const query = {
        'settings.password': { $regex: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (excludeRoomId) {
        query.roomId = { $ne: excludeRoomId.toUpperCase() };
      }
      const existing = await Room.findOne(query).select('roomId').lean();
      if (existing) return false;
    } catch (err) {
      console.error('[roomManager.isPasswordUnique]', err.message);
    }
  }

  return true;
}

async function getOrLoadRoomByPassword(password) {
  if (!password || typeof password !== 'string') return null;
  const clean = password.trim().toLowerCase();

  // Search memory first
  for (const room of rooms.values()) {
    if (room.settings.password && room.settings.password.toLowerCase() === clean) {
      return room;
    }
  }

  // Search MongoDB
  if (isDbConnected()) {
    try {
      const doc = await Room.findOne({
        'settings.password': { $regex: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();

      if (doc) {
        return await loadRoomFromDb(doc.roomId);
      }
    } catch (err) {
      console.error('[roomManager.getOrLoadRoomByPassword]', err.message);
    }
  }

  return null;
}

// Host-triggered permanent deletion from both memory and MongoDB
async function deleteRoomCompletely(roomId) {
  if (!roomId) return;
  const upper = roomId.toUpperCase();
  rooms.delete(upper);

  if (isDbConnected()) {
    try {
      await Room.deleteOne({ roomId: upper });
      console.log(`[roomManager] Room ${upper} permanently deleted from MongoDB`);
    } catch (err) {
      console.error(`[roomManager] Failed to delete room ${upper}:`, err.message);
    }
  }
}

// Periodically persist active rooms to MongoDB (best-effort, non-blocking).
async function persistRoom(room) {
  if (!isDbConnected()) return;
  try {
    await Room.findOneAndUpdate(
      { roomId: room.roomId },
      {
        roomId: room.roomId,
        creatorUserId: room.creatorUserId,
        creatorName: room.creatorName,
        hostUserId: room.hostUserId,
        members: serializeMembers(room),
        queue: room.queue,
        currentVideo: room.currentVideo,
        settings: {
          locked: !!room.settings.locked,
          maxMembers: room.settings.maxMembers || MAX_ROOM_MEMBERS,
          hasPassword: !!room.settings.password,
          password: room.settings.password || null
        },
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

// Clean up rooms from in-memory cache when idle, ensuring state stays permanently in MongoDB
function pruneEmptyRooms() {
  const inactivityMs = (parseInt(process.env.ROOM_INACTIVITY_MINUTES, 10) || 180) * 60 * 1000;
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    const hasConnected = Array.from(room.members.values()).some((m) => m.connected);
    const stale = now - room.lastActivity > inactivityMs;
    if (!hasConnected && stale) {
      persistRoom(room);
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
  getOrLoadRoomByPassword,
  isPasswordUnique,
  loadRoomFromDb,
  serializeRoom,
  serializeMembers,
  addMember,
  removeSocketFromMember,
  purgeDisconnectedMember,
  isHost,
  setPassword,
  verifyPassword,
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
  deleteRoomCompletely,
  pruneEmptyRooms,
  getActiveRoomCount,
  touch,
  MAX_ROOM_MEMBERS
};

