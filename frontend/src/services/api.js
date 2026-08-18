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

export async function createRoom(hostName) {
  const res = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName })
  });
  return handleResponse(res);
}

export async function getRoomInfo(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}`);
  return handleResponse(res);
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  return handleResponse(res);
}
