const USER_ID_KEY = 'lt_user_id';
const NAME_KEY = 'lt_display_name';
const CREATED_ROOMS_KEY = 'lt_created_rooms';
const JOINED_ROOMS_KEY = 'lt_joined_rooms';

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

export function saveCreatedRoom(roomId, password) {
  if (!roomId) return;
  const upper = roomId.toUpperCase().trim();
  try {
    const list = JSON.parse(localStorage.getItem(CREATED_ROOMS_KEY) || '[]');
    if (!list.includes(upper)) {
      list.unshift(upper);
      localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(list.slice(0, 50)));
    }
    if (password) {
      sessionStorage.setItem(`lt_room_pwd_${upper}`, password);
      localStorage.setItem(`lt_room_pwd_${upper}`, password);
    }
  } catch {
    // ignore storage error
  }
}

export function saveJoinedRoom(roomId, password) {
  if (!roomId) return;
  const upper = roomId.toUpperCase().trim();
  try {
    const list = JSON.parse(localStorage.getItem(JOINED_ROOMS_KEY) || '[]');
    if (!list.includes(upper)) {
      list.unshift(upper);
      localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(list.slice(0, 50)));
    }
    if (password) {
      sessionStorage.setItem(`lt_room_pwd_${upper}`, password);
      localStorage.setItem(`lt_room_pwd_${upper}`, password);
    }
  } catch {
    // ignore storage error
  }
}

export function getSavedCreatedRoomIds() {
  try {
    return JSON.parse(localStorage.getItem(CREATED_ROOMS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getSavedJoinedRoomIds() {
  try {
    return JSON.parse(localStorage.getItem(JOINED_ROOMS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getAllSavedRoomIds() {
  const created = getSavedCreatedRoomIds();
  const joined = getSavedJoinedRoomIds();
  return Array.from(new Set([...created, ...joined]));
}

export function removeSavedRoom(roomId) {
  if (!roomId) return;
  const upper = roomId.toUpperCase().trim();
  try {
    const created = getSavedCreatedRoomIds().filter((id) => id !== upper);
    localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(created));

    const joined = getSavedJoinedRoomIds().filter((id) => id !== upper);
    localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(joined));

    sessionStorage.removeItem(`lt_room_pwd_${upper}`);
    localStorage.removeItem(`lt_room_pwd_${upper}`);
  } catch {
    // ignore
  }
}
