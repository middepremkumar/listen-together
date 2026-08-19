export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function handleResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no-op: empty/non-JSON body
  }
  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function googleLogin(credential) {
  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  return handleResponse(res);
}

export async function fetchCurrentUser(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return handleResponse(res);
}

export async function fetchAuthConfig() {
  const res = await fetch(`${API_BASE_URL}/api/auth/config`);
  return handleResponse(res);
}

export async function createRoom(hostName, password) {
  const res = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostName,
      password: password || undefined
    })
  });
  return handleResponse(res);
}

export async function getRoomInfo(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}`);
  return handleResponse(res);
}

export async function verifyRoomPassword(roomId, password) {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return handleResponse(res);
}

export async function findRoomByPassword(password) {
  const res = await fetch(`${API_BASE_URL}/api/rooms/find-by-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return handleResponse(res);
}

export async function deleteRoomApi(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE'
  });
  return handleResponse(res);
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  return handleResponse(res);
}


