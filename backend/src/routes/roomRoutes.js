const express = require('express');
const { createRoom, getRoomInfo } = require('../controllers/roomController');

const router = express.Router();

router.post('/', createRoom);
router.get('/:roomId', getRoomInfo);

module.exports = router;
