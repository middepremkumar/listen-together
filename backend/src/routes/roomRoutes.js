const express = require('express');
const { createRoom, getRoomInfo, verifyRoomPassword } = require('../controllers/roomController');

const router = express.Router();

router.post('/', createRoom);
router.get('/:roomId', getRoomInfo);
router.post('/:roomId/verify-password', verifyRoomPassword);

module.exports = router;

