const express = require('express');
const {
  createRoom,
  getRoomInfo,
  findRoomByPassword,
  verifyRoomPassword,
  deleteRoom
} = require('../controllers/roomController');

const router = express.Router();

router.post('/', createRoom);
router.post('/find-by-password', findRoomByPassword);
router.get('/:roomId', getRoomInfo);
router.post('/:roomId/verify-password', verifyRoomPassword);
router.delete('/:roomId', deleteRoom);

module.exports = router;


