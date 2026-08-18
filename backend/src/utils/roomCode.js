const { customAlphabet } = require('nanoid');

// Avoid ambiguous chars (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 5);

function generateRoomCode() {
  return generate();
}

module.exports = { generateRoomCode };
