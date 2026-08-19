const express = require('express');
const {
  createRoom,
  getRoomInfo,
  findRoomByPassword,
  verifyRoomPassword,
  getUserRooms,
  deleteRoom
} = require('../controllers/roomController');

const router = express.Router();

router.post('/', createRoom);
router.post('/find-by-password', findRoomByPassword);
router.get('/user-rooms', getUserRooms);
router.get('/:roomId', getRoomInfo);
router.post('/:roomId/verify-password', verifyRoomPassword);
router.delete('/:roomId', deleteRoom);

module.exports = router;


