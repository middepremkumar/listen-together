const ADJECTIVES = [
  'sonic', 'cosmic', 'neon', 'lunar', 'solar', 'hyper', 'cyber', 'retro',
  'velvet', 'golden', 'crystal', 'electric', 'mystic', 'vibrant', 'stellar',
  'silent', 'turbo', 'groove', 'radiant', 'ambient'
];

const NOUNS = [
  'beat', 'tiger', 'pulse', 'wave', 'echo', 'track', 'vibe', 'rhythm',
  'melody', 'sound', 'tempo', 'audio', 'chord', 'synth', 'tune', 'nexus',
  'spark', 'dynamo', 'phoenix', 'orbit'
];

export function generateStrongPasskey() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}-${noun}-${num}`;
}
