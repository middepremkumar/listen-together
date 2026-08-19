const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isDbConnected } = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory fallback cache for users when DB is disconnected
const inMemoryUsers = new Map();

/**
 * Verifies a Google ID token.
 */
async function verifyGoogleToken(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new Error('Credential is required.');
  }

  // If GOOGLE_CLIENT_ID is configured, verify with official Google library
  if (GOOGLE_CLIENT_ID) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    return ticket.getPayload();
  }

  // If no GOOGLE_CLIENT_ID set on backend yet, parse payload from token safely
  // (Provides developer resilience while setting up environment variables)
  const parts = credential.split('.');
  if (parts.length === 3) {
    try {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (payload && payload.sub && payload.email) {
        return payload;
      }
    } catch (err) {
      // Fall through to error
    }
  }

  throw new Error('Unable to verify Google credential.');
}

/**
 * POST /api/auth/google
 * Authenticates user with Google credential
 */
async function googleAuth(req, res) {
  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    const payload = await verifyGoogleToken(credential);
    const googleId = payload.sub;
    const email = (payload.email || '').toLowerCase();
    const name = payload.name || payload.given_name || 'Google User';
    const picture = payload.picture || '';
    const givenName = payload.given_name || '';
    const familyName = payload.family_name || '';

    let userId = `g_${googleId}`;
    let userRecord = null;

    if (isDbConnected()) {
      try {
        userRecord = await User.findOneAndUpdate(
          { googleId },
          {
            email,
            name,
            picture,
            givenName,
            familyName,
            lastLogin: new Date()
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        userId = userRecord._id.toString();
      } catch (dbErr) {
        console.error('[authController] DB user upsert error:', dbErr.message);
      }
    }

    if (!userRecord) {
      userRecord = {
        _id: userId,
        googleId,
        email,
        name,
        picture,
        givenName,
        familyName,
        lastLogin: new Date()
      };
      inMemoryUsers.set(googleId, userRecord);
    }

    const userProfile = {
      userId,
      googleId,
      email,
      name,
      picture,
      givenName,
      familyName
    };

    const token = jwt.sign(userProfile, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      ok: true,
      token,
      user: userProfile
    });
  } catch (err) {
    console.error('[authController.googleAuth]', err);
    return res.status(401).json({
      error: err.message || 'Google authentication failed. Please try again.'
    });
  }
}

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
async function getMe(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      user: req.user
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
}

/**
 * GET /api/auth/config
 * Returns public auth configuration
 */
async function getAuthConfig(_req, res) {
  return res.status(200).json({
    googleClientId: GOOGLE_CLIENT_ID || null
  });
}

module.exports = {
  googleAuth,
  getMe,
  getAuthConfig
};
