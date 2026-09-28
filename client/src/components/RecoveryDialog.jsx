import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { apiRequest } from '../api.js';

export default function RecoveryDialog({ token, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await apiRequest('/auth/' + (token ? 'reset-password' : 'forgot-password'), { method: 'POST', body: JSON.stringify(token ? { token, password, confirmPassword: confirm } : { email }) });
      setMessage(data.message);
      if (token) history.replaceState(null, '', location.pathname + location.search);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <Modal onClose={onClose} titleId="recovery-title" className="recovery-modal"><div className="market-modal-content">
    <p className="eyebrow">A fresh start</p><h2 id="recovery-title">{token ? 'A new password.' : 'Forgot your password?'}</h2>
    <p className="market-muted">{token ? 'Choose a new password to get back to the art you love.' : 'Enter your account email. We’ll send you a link to reset your password.'}</p>
    {message ? <div className="success-note" role="status">{message}</div> : <form onSubmit={submit} className="settings-form">
      {token ? <><label className="market-field">New password<input type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="market-field">Confirm new password<input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label></> : <label className="market-field">Email address<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : token ? 'Reset password →' : 'Send reset link →'}</button>
    </form>}<button className="text-link" onClick={onLogin}>Back to sign in</button>
  </div></Modal>;
}
