export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
    });
  } catch { throw new Error('Unable to connect. Please check your connection and try again.'); }
  if (response.status === 204) return null;
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The account service is unavailable. Please try again shortly.'); }
  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong. Please try again.');
    error.fields = data.fields;
    error.status = response.status;
    throw error;
  }
  return data;
}
