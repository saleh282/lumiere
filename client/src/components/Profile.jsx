import React, { useState } from 'react';
import { apiRequest } from '../api.js';

export function ProfileHeader({ user, mine, favorites, inquiries, tab, onTab, onSell }) {
  return <section className="profile-header container"><p className="eyebrow">Your little corner of the art world</p><div className="profile-intro"><div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div><div><h1>{user.name}</h1><p>{user.bio || 'A place for the art you create and the pieces you love.'}</p><small>{user.location ? user.location + ' · ' : ''}Member since {new Date(user.createdAt).getFullYear()}</small></div><button className="primary-button" onClick={onSell}>+ Add artwork</button></div><div className="profile-stats"><span><strong>{mine.length}</strong> Artworks</span><span><strong>{favorites.length}</strong> Favorites</span><span><strong>{mine.filter(p => p.status === 'sold').length}</strong> Sold</span></div><nav className="profile-tabs" aria-label="Profile sections">{[['mine', 'My artworks'], ['saved', 'Favorites'], ['inquiries', 'Contact requests'], ['settings', 'Edit profile']].map(([key, title]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => onTab(key)}>{title}{key === 'inquiries' && inquiries.length ? ` (${inquiries.length})` : ''}</button>)}</nav></section>;
}

export function ProfileSettings({ user, onUpdated, onLogout }) {
  const [values, setValues] = useState({ name: user.name, bio: user.bio, location: user.location, phone: user.phone });
  const [passwords, setPasswords] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(event, type) {
    event.preventDefault(); setBusy(type); setError(''); setMessage('');
    try {
      const result = await apiRequest('/auth/' + (type === 'profile' ? 'profile' : 'change-password'), { method: type === 'profile' ? 'PUT' : 'POST', body: JSON.stringify(type === 'profile' ? values : passwords) });
      if (result.user) onUpdated(result.user);
      else setPasswords({ currentPassword: '', password: '', confirmPassword: '' });
      setMessage(result.message || 'Your profile has been updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  async function logout() {
    setBusy('logout'); setError('');
    try { await apiRequest('/auth/logout', { method: 'POST', body: '{}' }); onLogout(); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  return <section className="container profile-settings">{message && <p className="success-note" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="settings-columns"><form className="settings-form" onSubmit={e => save(e, 'profile')}><h2>Personal details</h2><p className="market-muted">Make yourself at home.</p>{[['name', 'Full name', 80], ['location', 'Location', 100], ['phone', 'Phone number', 30]].map(([key, title, max]) => <label className="market-field" key={key}>{title}<input type={key === 'phone' ? 'tel' : 'text'} value={values[key] || ''} required={key === 'name'} minLength={key === 'name' ? 2 : undefined} maxLength={max} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}<label className="market-field">About you<textarea rows={4} maxLength={500} value={values.bio || ''} onChange={e => setValues({ ...values, bio: e.target.value })} /></label><p className="market-muted">Account email: {user.email}<br />Your profile phone is private. Add a phone to a listing to share it with buyers.</p><button className="primary-button" disabled={!!busy}>{busy === 'profile' ? 'Saving…' : 'Save profile →'}</button></form><form className="settings-form" onSubmit={e => save(e, 'password')}><h2>Password & security</h2><p className="market-muted">Use at least 10 characters, up to 72 UTF-8 bytes.</p>{[['currentPassword', 'Current password'], ['password', 'New password'], ['confirmPassword', 'Confirm new password']].map(([key, title]) => <label className="market-field" key={key}>{title}<input type="password" required autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} value={passwords[key]} onChange={e => setPasswords({ ...passwords, [key]: e.target.value })} /></label>)}<button className="primary-button" disabled={!!busy}>{busy === 'password' ? 'Updating…' : 'Change password →'}</button><button type="button" className="text-link" disabled={!!busy} onClick={logout}>Sign out of your account</button></form></div></section>;
}
