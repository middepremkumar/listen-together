const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rooms created. Please wait a moment and try again.' }
});

// Simple sliding-window limiter for socket events, keyed by socket id + event name.
class SocketRateLimiter {
  constructor() {
    this.hits = new Map();
  }

  /**
   * @returns {boolean} true if the action is allowed, false if rate-limited
   */
  allow(key, limit, windowMs) {
    const now = Date.now();
    const entry = this.hits.get(key) || [];
    const recent = entry.filter((t) => now - t < windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= limit;
  }

  clear(key) {
    this.hits.delete(key);
  }
}

module.exports = { apiLimiter, createRoomLimiter, SocketRateLimiter };
