const xss = require('xss');

const ROOM_CODE_REGEX = /^[A-Z0-9]{4,8}$/i;

function isValidRoomCode(code) {
  return typeof code === 'string' && ROOM_CODE_REGEX.test(code.trim());
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  const clean = xss(name.trim()).slice(0, 24);
  return clean;
}

function isValidName(name) {
  const clean = sanitizeName(name);
  return clean.length >= 1 && clean.length <= 24;
}

function sanitizeMessage(text) {
  if (typeof text !== 'string') return '';
  return xss(text.trim()).slice(0, 500);
}

function isValidMessage(text) {
  const clean = sanitizeMessage(text);
  return clean.length >= 1 && clean.length <= 500;
}

// Extract an 11-character YouTube video ID from a variety of URL formats,
// or accept a bare 11-char ID.
function extractYouTubeId(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  // Bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

module.exports = {
  isValidRoomCode,
  sanitizeName,
  isValidName,
  sanitizeMessage,
  isValidMessage,
  extractYouTubeId
};
