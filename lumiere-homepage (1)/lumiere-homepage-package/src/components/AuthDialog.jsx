import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { apiRequest } from '../api.js';

export default function AuthDialog({ mode, setMode, user, savedCount, onClose, onAuthenticated, onLogout, onViewSaved }) {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const registering = mode === 'register';
  const update = event => {
    setValues(current => ({ ...current, [event.target.name]: event.target.value }));
    setErrors(current => ({ ...current, [event.target.name]: '', form: '' }));
  };
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (registering && (values.name.trim().length < 2 || values.name.trim().length > 80)) next.name = 'Enter your name (2–80 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (values.password.length < 10 || values.password.length > 128) next.password = 'Use 10–128 characters for your password.';
    if (registering && values.confirm !== values.password) next.confirm = 'Your passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const data = await apiRequest(registering ? '/register' : '/login', { method: 'POST', body: JSON.stringify({ name: values.name.trim(), email: values.email.trim(), password: values.password }) });
      onAuthenticated(data);
    } catch (error) { setErrors({ [error.field || 'form']: error.message }); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await apiRequest('/logout', { method: 'POST', body: '{}' }); onLogout(); }
    catch (error) { setErrors({ form: error.message }); }
    finally { setBusy(false); }
  }
  function changeMode() {
    setErrors({}); setValues(current => ({ ...current, password: '', confirm: '' })); setShowPassword(false);
    setMode(registering ? 'login' : 'register');
  }
  function field(name, label, type = 'text', autoComplete = name) {
    return <div className="form-field"><label htmlFor={`auth-${name}`}>{label}</label><input id={`auth-${name}`} name={name} type={type} autoComplete={autoComplete} value={values[name]} onChange={update} disabled={busy} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined} maxLength={name === 'email' ? 254 : name === 'name' ? 80 : 128} required />{errors[name] && <p className="field-error" id={`error-${name}`} role="alert">{errors[name]}</p>}</div>;
  }
  return <Modal onClose={onClose} titleId="auth-title" className="auth-modal">
    <div className="auth-visual"><img src="/artworks/water-lily-pond.jpg" alt="Claude Monet's Water Lily Pond" /><div><a className="wordmark" href="#" onClick={onClose}>lumière<span>®</span></a><p>A little art.<br /><em>A world of your own.</em></p><span>Collect the things that move you.</span></div><small>Claude Monet · The Water Lily Pond</small></div>
    <div className="auth-content">
      {user ? <><p className="eyebrow">Your personal gallery</p><div className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div><h2 id="auth-title">Hello, {user.name.split(' ')[0]}.</h2><p className="auth-intro">A little space for everything you love.</p><dl className="account-details"><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Saved artworks</dt><dd>{savedCount}</dd></div></dl><button className="primary-button" onClick={onViewSaved}>Open my collection <span aria-hidden="true">→</span></button><button className="secondary-button" disabled={busy} onClick={logout}>{busy ? 'Signing out…' : 'Sign out'}</button>{errors.form && <p className="form-error" role="alert">{errors.form}</p>}</> :
      <><p className="eyebrow">{registering ? 'Make yourself at home' : 'Your collection is waiting'}</p><h2 id="auth-title">{registering ? 'A good eye deserves\na place to collect.' : 'Welcome back.'}</h2><p className="auth-intro">{registering ? 'Create your account and keep your favorite works together.' : 'Sign in to return to the art you love.'}</p>
        <div className="auth-tabs" role="group" aria-label="Account access"><button type="button" disabled={busy} aria-pressed={registering} className={registering ? 'active' : ''} onClick={() => { if (!registering) changeMode(); }}>Create account</button><button type="button" disabled={busy} aria-pressed={!registering} className={!registering ? 'active' : ''} onClick={() => { if (registering) changeMode(); }}>Sign in</button></div>
        <form noValidate onSubmit={submit} aria-busy={busy}>
          {registering && field('name', 'Full name', 'text', 'name')}
          {field('email', 'Email address', 'email', 'email')}
          {field('password', 'Password', showPassword ? 'text' : 'password', registering ? 'new-password' : 'current-password')}
          <div className="password-help"><span>{registering ? 'At least 10 characters' : 'Your password is case-sensitive'}</span><button type="button" disabled={busy} onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword}>{showPassword ? 'Hide password' : 'Show password'}</button></div>
          {registering && field('confirm', 'Confirm password', showPassword ? 'text' : 'password', 'new-password')}
          {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
          <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? (registering ? 'Creating your account…' : 'Signing in…') : (registering ? 'Create my account' : 'Sign in')}<span aria-hidden="true">→</span></button>
          <p className="privacy-note">Your name and email identify your account. Your saved artworks are private to your account. We never display your email publicly.</p>
        </form>
      </>}
    </div>
  </Modal>;
}
