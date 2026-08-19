const roomManager = require('../socket/roomManager');
const { isValidRoomCode, isValidName, sanitizeName } = require('../utils/validators');

// POST /api/rooms
async function createRoom(req, res) {
  try {
    const { hostName, hostUserId, password } = req.body || {};

    if (!isValidName(hostName)) {
      return res.status(400).json({ error: 'A valid display name (1-24 characters) is required.' });
    }

    const cleanPassword = typeof password === 'string' && password.trim() ? password.trim() : null;
    if (!cleanPassword) {
      return res.status(400).json({ error: 'Room password is required to create a room.' });
    }

    if (cleanPassword.length < 3) {
      return res.status(400).json({ error: 'Room password must be at least 3 characters long.' });
    }
    if (cleanPassword.length > 64) {
      return res.status(400).json({ error: 'Password must not exceed 64 characters.' });
    }
    const isUnique = await roomManager.isPasswordUnique(cleanPassword);
    if (!isUnique) {
      return res.status(400).json({
        error: 'That room password is already in use by another active room. Please choose another or generate a strong passkey.'
      });
    }

    const room = await roomManager.createRoom({
      hostUserId: hostUserId || null,
      hostName: sanitizeName(hostName),
      password: cleanPassword
    });

    return res.status(201).json({
      roomId: room.roomId,
      creatorUserId: room.creatorUserId,
      hostName: sanitizeName(hostName),
      hasPassword: true,
      password: cleanPassword
    });
  } catch (err) {
    console.error('[roomController.createRoom]', err);
    return res.status(500).json({ error: 'Failed to create room. Please try again.' });
  }
}

// GET /api/rooms/:roomId
async function getRoomInfo(req, res) {
  try {
    const { roomId } = req.params;

    if (!isValidRoomCode(roomId)) {
      return res.status(400).json({ error: 'Invalid room code format.' });
    }

    const room = await roomManager.getOrLoadRoom(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const memberCount = Array.from(room.members.values()).filter((m) => m.connected).length;

    return res.status(200).json({
      roomId: room.roomId,
      memberCount,
      maxMembers: room.settings.maxMembers,
      locked: room.settings.locked,
      hasPassword: !!room.settings.password,
      full: memberCount >= room.settings.maxMembers,
      currentVideoTitle: room.currentVideo.title || null
    });
  } catch (err) {
    console.error('[roomController.getRoomInfo]', err);
    return res.status(500).json({ error: 'Failed to fetch room info.' });
  }
}

// POST /api/rooms/find-by-password
async function findRoomByPassword(req, res) {
  try {
    const { password } = req.body || {};
    const cleanPassword = typeof password === 'string' ? password.trim() : '';

    if (!cleanPassword) {
      return res.status(400).json({ error: 'Room password is required.' });
    }

    const room = await roomManager.getOrLoadRoomByPassword(cleanPassword);
    if (!room) {
      return res.status(404).json({ error: 'No room found matching that password.' });
    }

    const memberCount = Array.from(room.members.values()).filter((m) => m.connected).length;

    return res.status(200).json({
      roomId: room.roomId,
      memberCount,
      maxMembers: room.settings.maxMembers,
      locked: room.settings.locked,
      hasPassword: true,
      full: memberCount >= room.settings.maxMembers,
      currentVideoTitle: room.currentVideo.title || null
    });
  } catch (err) {
    console.error('[roomController.findRoomByPassword]', err);
    return res.status(500).json({ error: 'Failed to find room by password.' });
  }
}

// POST /api/rooms/:roomId/verify-password
async function verifyRoomPassword(req, res) {
  try {
    const { roomId } = req.params;
    const { password } = req.body || {};

    if (!isValidRoomCode(roomId)) {
      return res.status(400).json({ error: 'Invalid room code format.' });
    }

    const room = await roomManager.getOrLoadRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    if (!room.settings.password) {
      return res.status(200).json({ ok: true, requiresPassword: false });
    }

    const valid = roomManager.verifyPassword(room, password);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Incorrect room password.' });
    }

    return res.status(200).json({ ok: true, requiresPassword: true });
  } catch (err) {
    console.error('[roomController.verifyRoomPassword]', err);
    return res.status(500).json({ error: 'Failed to verify room password.' });
  }
}

// GET /api/rooms/user-rooms
async function getUserRooms(req, res) {
  try {
    const userId = req.query.userId || req.user?.userId || '';
    const rawRoomIds = req.query.roomIds ? String(req.query.roomIds).split(',') : [];

    const { createdRooms, joinedRooms } = await roomManager.getUserRooms(userId, rawRoomIds);
    return res.status(200).json({ createdRooms, joinedRooms });
  } catch (err) {
    console.error('[roomController.getUserRooms]', err);
    return res.status(500).json({ error: 'Failed to fetch user rooms.' });
  }
}

// DELETE /api/rooms/:roomId
async function deleteRoom(req, res) {
  try {
    const { roomId } = req.params;
    if (!isValidRoomCode(roomId)) {
      return res.status(400).json({ error: 'Invalid room code format.' });
    }

    await roomManager.deleteRoomCompletely(roomId);
    return res.status(200).json({ ok: true, message: 'Room deleted successfully.' });
  } catch (err) {
    console.error('[roomController.deleteRoom]', err);
    return res.status(500).json({ error: 'Failed to delete room.' });
  }
}

module.exports = {
  createRoom,
  getRoomInfo,
  findRoomByPassword,
  verifyRoomPassword,
  getUserRooms,
  deleteRoom
};



