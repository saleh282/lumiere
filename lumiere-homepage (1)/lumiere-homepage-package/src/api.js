export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch { throw new Error('Unable to connect. Please check your connection and try again.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The account service is unavailable. Please try again shortly.'); }
  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.field = data.field;
    error.status = response.status;
    throw error;
  }
  return data;
}
export function guestFavorites() {
  try {
    const data = JSON.parse(localStorage.getItem('lumiere-saved') || '[]');
    return Array.isArray(data) ? data.filter(item => typeof item === 'string') : [];
  } catch { return []; }
}
