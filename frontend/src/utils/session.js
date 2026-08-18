const USER_ID_KEY = 'lt_user_id';
const NAME_KEY = 'lt_display_name';

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getSavedName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function saveName(name) {
  if (name) localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}
