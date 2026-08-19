const express = require('express');
const { googleAuth, getMe, getAuthConfig } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/google', googleAuth);
router.get('/me', requireAuth, getMe);
router.get('/config', getAuthConfig);

module.exports = router;
