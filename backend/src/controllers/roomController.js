const roomManager = require('../socket/roomManager');
const { isValidRoomCode, isValidName, sanitizeName } = require('../utils/validators');

// POST /api/rooms
async function createRoom(req, res) {
  try {
    const { hostName } = req.body || {};

    if (!isValidName(hostName)) {
      return res.status(400).json({ error: 'A valid display name (1-24 characters) is required.' });
    }

    const room = await roomManager.createRoom();

    return res.status(201).json({
      roomId: room.roomId,
      hostName: sanitizeName(hostName)
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
      full: memberCount >= room.settings.maxMembers,
      currentVideoTitle: room.currentVideo.title || null
    });
  } catch (err) {
    console.error('[roomController.getRoomInfo]', err);
    return res.status(500).json({ error: 'Failed to fetch room info.' });
  }
}

module.exports = { createRoom, getRoomInfo };
