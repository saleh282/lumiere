import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import AuthDialog from './components/AuthDialog.jsx';
import Modal from './components/Modal.jsx';

const categories = ['Abstract', 'Landscapes', 'Seascapes', 'Portraits', 'Still life', 'Other'];
const money = value => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value);
const blank = { title: '', description: '', category: 'Abstract', medium: '', dimensions: '', location: '', price: '', year: '', status: 'available' };

function ListingForm({ painting, onClose, onSaved }) {
  const [values, setValues] = useState(painting ? { ...painting, year: painting.year || '' } : blank);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(painting?.imageUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setFields({});
    const body = new FormData();
    for (const key of ['title', 'description', 'category', 'medium', 'dimensions', 'location', 'price']) body.set(key, values[key]);
    if (values.year !== '' || painting) body.set('year', values.year);
    if (painting) body.set('status', values.status);
    if (image) body.set('image', image);
    try {
      const result = await apiRequest('/paintings' + (painting ? '/' + painting.id : ''), { method: painting ? 'PUT' : 'POST', body });
      onSaved(result.painting);
    } catch (err) { setError(err.message); setFields(err.fields || {}); }
    finally { setBusy(false); }
  }
  const field = (name, label, props = {}) => <label className="market-field" key={name}><span>{label}</span><input value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })} required={name !== 'year'} {...props} />{fields[name] && <small>{fields[name]}</small>}</label>;
  return <Modal onClose={onClose} titleId="listing-title" className="market-modal"><div className="market-modal-content">
    <p className="eyebrow">Your studio</p><h2 id="listing-title">{painting ? 'Edit your listing' : 'Sell a painting'}</h2>
    <p className="market-muted">Share the original work, its details and where it can be collected. Prices are in EGP.</p>
    <form onSubmit={submit} className="listing-form">
      <label className="market-field image-field"><span>Painting image *</span><input type="file" accept="image/jpeg,image/png,image/webp" required={!painting} onChange={event => setImage(event.target.files?.[0] || null)} />{preview && <img src={preview} alt="Painting preview" />}{fields.image && <small>{fields.image}</small>}</label>
      {field('title', 'Title *', { minLength: 2, maxLength: 120 })}
      <label className="market-field"><span>Category *</span><select value={values.category} onChange={event => setValues({ ...values, category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
      {field('medium', 'Medium *', { maxLength: 100 })}
      {field('dimensions', 'Dimensions *', { placeholder: '50 × 70 cm', maxLength: 100 })}
      {field('location', 'Location *', { placeholder: 'Cairo, Heliopolis', maxLength: 100 })}
      {field('price', 'Price (EGP) *', { type: 'number', min: '0.01', step: '0.01' })}
      {field('year', 'Year (optional)', { type: 'number', min: 1000, max: new Date().getFullYear() + 1 })}
      <label className="market-field wide"><span>Description *</span><textarea value={values.description} minLength={10} maxLength={5000} required rows={5} onChange={event => setValues({ ...values, description: event.target.value })} />{fields.description && <small>{fields.description}</small>}</label>
      {painting && <label className="market-field"><span>Status</span><select value={values.status} onChange={event => setValues({ ...values, status: event.target.value })}><option value="available">Available</option><option value="sold">Sold</option></select></label>}
      {error && <p className="form-error wide" role="alert">{error}</p>}
      <button className="primary-button wide" disabled={busy}>{busy ? 'Saving…' : painting ? 'Save changes' : 'Publish listing'} →</button>
    </form>
  </div></Modal>;
}

function PaintingDetail({ painting, user, saved, onSave, onClose, onLogin }) {
  const [contact, setContact] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function requestContact() {
    if (!user) return onLogin();
    setBusy(true); setError('');
    try { setContact(await apiRequest('/paintings/' + painting.id + '/contact')); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <Modal onClose={onClose} titleId="detail-title" className="market-detail"><div className="detail-grid">
    <div className="detail-photo"><img src={painting.imageUrl} alt={painting.title} /></div>
    <div className="detail-copy"><p className="eyebrow">{painting.category} · {painting.status}</p><h2 id="detail-title">{painting.title}</h2><p className="market-muted">By {painting.seller?.name}</p><p className="detail-price">{money(painting.price)}</p>
      <p className="detail-description">{painting.description}</p>
      <dl><div><dt>Medium</dt><dd>{painting.medium}</dd></div><div><dt>Dimensions</dt><dd>{painting.dimensions}</dd></div><div><dt>Location</dt><dd>{painting.location}</dd></div>{painting.year && <div><dt>Year</dt><dd>{painting.year}</dd></div>}</dl>
      <div className="detail-actions"><button className="primary-button" onClick={requestContact} disabled={busy || painting.status === 'sold'}>{busy ? 'Loading…' : painting.status === 'sold' ? 'Sold' : 'Contact seller →'}</button><button className="secondary-button" onClick={() => onSave(painting.id)}>{saved ? '♥ Saved' : '♡ Save'}</button></div>
      {contact && <div className="contact-card"><strong>Contact {contact.name}</strong><a href={'mailto:' + contact.email + '?subject=' + encodeURIComponent('Lumière: ' + painting.title)}>{contact.email}</a><small>Your interest is now visible in the seller’s account.</small></div>}
      {error && <p className="form-error">{error}</p>}
      <p className="market-muted">Sale and delivery are arranged directly with the seller. No online payment is taken here.</p>
    </div>
  </div></Modal>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [afterAuth, setAfterAuth] = useState(null);
  const [paintings, setPaintings] = useState([]);
  const [mine, setMine] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [view, setView] = useState('market');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [filters, setFilters] = useState({ search: '', category: '', location: '', minPrice: '', maxPrice: '', sort: 'newest' });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadMarket() {
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '12', sort: filters.sort });
    for (const key of ['search', 'category', 'location', 'minPrice', 'maxPrice']) if (filters[key]) params.set(key, filters[key]);
    try { const data = await apiRequest('/paintings?' + params); setPaintings(data.paintings); setPages(data.pages); }
    catch (err) { setError(err.message); setPaintings([]); }
    finally { setLoading(false); }
  }
  async function loadPrivate() {
    try {
      const [own, saved, requested] = await Promise.all([apiRequest('/paintings/mine'), apiRequest('/favorites'), apiRequest('/inquiries/mine')]);
      setMine(own.paintings); setFavorites(saved.paintings); setInquiries(requested.inquiries);
    } catch (err) { setNotice(err.message); }
  }
  useEffect(() => { apiRequest('/auth/me').then(data => setUser(data.user)).catch(() => {}); }, []);
  useEffect(() => { loadMarket(); }, [filters, page]);
  useEffect(() => { if (user) loadPrivate(); else { setMine([]); setFavorites([]); setInquiries([]); } }, [user]);
  function gate(action) { if (user) action(); else { setAfterAuth(() => action); setAuthMode('login'); } }
  function openSell() { gate(() => setEditing(null)); }
  function changeFilter(key, value) { setPage(1); setFilters(current => ({ ...current, [key]: value })); }
  async function toggleFavorite(id, authenticated = false) {
    if (!user && !authenticated) return gate(() => toggleFavorite(id, true));
    const saved = !favorites.some(item => item.id === id);
    try {
      await apiRequest('/favorites', { method: 'PUT', body: JSON.stringify({ paintingId: id, saved }) });
      const data = await apiRequest('/favorites'); setFavorites(data.paintings);
      setNotice(saved ? 'Added to your favorites.' : 'Removed from your favorites.');
    } catch (err) { setNotice(err.message); }
  }
  async function removePainting(painting) {
    if (!window.confirm('Delete "' + painting.title + '" permanently?')) return;
    try { await apiRequest('/paintings/' + painting.id, { method: 'DELETE' }); setMine(items => items.filter(item => item.id !== painting.id)); setNotice('Listing deleted.'); loadMarket(); }
    catch (err) { setNotice(err.message); }
  }
  async function markSold(painting) {
    try { await apiRequest('/paintings/' + painting.id, { method: 'PUT', body: JSON.stringify({ status: painting.status === 'sold' ? 'available' : 'sold' }) }); await loadPrivate(); loadMarket(); }
    catch (err) { setNotice(err.message); }
  }
  const shown = view === 'mine' ? mine : view === 'saved' ? favorites : paintings;
  return <div className="market-app">
    <div className="announcement">Original art, directly from its owner <span>·</span> Explore · Connect · Collect</div>
    <header className="site-header container"><button className="wordmark" onClick={() => setView('market')}>lumière<span>®</span></button><nav><button onClick={() => setView('market')}>Marketplace</button><button onClick={() => { gate(() => setView('mine')); }}>My listings</button><button onClick={() => { gate(() => setView('saved')); }}>Favorites</button></nav><div className="header-actions"><button className="sell-link" onClick={openSell}>+ Sell a painting</button><button className="account-button" onClick={() => setAuthMode(user ? 'account' : 'login')}>{user ? user.name : 'Sign in'}</button></div></header>
    <main>
      <section className="market-hero container"><div><p className="eyebrow">THE LUMIÈRE MARKETPLACE</p><h1>Art with a story.<br /><em>Made yours.</em></h1><p>Discover original paintings from people who made or own them. Find a piece you love, then connect with the seller directly.</p><div className="hero-buttons"><button className="primary-button" onClick={() => { setView('market'); document.getElementById('market-grid')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore paintings →</button><button className="secondary-button" onClick={openSell}>Sell your artwork</button></div></div><div className="hero-exhibit"><img src="/artworks/water-lily-pond.jpg" alt="Painting inspiration" /><span>Find something that stays with you.</span></div></section>
      <section className="collection container" id="market-grid"><div className="section-heading"><div><p className="eyebrow">A place for original art</p><h2>{view === 'mine' ? 'My listings' : view === 'saved' ? 'My favorites' : 'The marketplace'}</h2></div><p>{view === 'market' ? 'Browse available paintings and contact sellers directly.' : view === 'mine' ? 'Manage the art you have listed for sale.' : 'Paintings you have saved for later.'}</p></div>
        {view === 'market' && <div className="market-filters"><input aria-label="Search by title" placeholder="Search paintings…" value={filters.search} onChange={event => changeFilter('search', event.target.value)} /><select aria-label="Category" value={filters.category} onChange={event => changeFilter('category', event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select><input aria-label="Location" placeholder="Location…" value={filters.location} onChange={event => changeFilter('location', event.target.value)} /><input aria-label="Minimum price" type="number" min="0" placeholder="Min EGP" value={filters.minPrice} onChange={event => changeFilter('minPrice', event.target.value)} /><input aria-label="Maximum price" type="number" min="0" placeholder="Max EGP" value={filters.maxPrice} onChange={event => changeFilter('maxPrice', event.target.value)} /><select aria-label="Sort" value={filters.sort} onChange={event => changeFilter('sort', event.target.value)}><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>}
        {view === 'mine' && <div className="market-tools"><button className="primary-button" onClick={openSell}>+ Add listing</button><span>{mine.length} listing(s)</span></div>}
        {view === 'saved' && <p className="market-muted">{favorites.length} saved painting(s)</p>}
        {error && view === 'market' && <p className="form-error">{error}</p>}
        {loading && view === 'market' ? <p className="market-empty">Loading paintings…</p> : shown.length ? <div className="gallery-grid">{shown.map(painting => <article className="art-card" key={painting.id}><button className="market-image" onClick={() => setSelected(painting)}><img src={painting.imageUrl} alt={painting.title} loading="lazy" />{painting.status === 'sold' && <span className="sold-out">Sold</span>}</button><div className="market-card-copy"><p className="eyebrow">{painting.category} · {painting.location}</p><button className="card-title" onClick={() => setSelected(painting)}>{painting.title}</button><p>By {painting.seller?.name}</p><strong>{money(painting.price)}</strong>{view === 'mine' ? <div className="card-actions"><button onClick={() => setEditing(painting)}>Edit</button><button onClick={() => markSold(painting)}>{painting.status === 'sold' ? 'Mark available' : 'Mark sold'}</button><button onClick={() => removePainting(painting)}>Delete</button></div> : <div className="card-actions"><button onClick={() => toggleFavorite(painting.id)}>{favorites.some(item => item.id === painting.id) ? '♥ Saved' : '♡ Save'}</button><button onClick={() => setSelected(painting)}>View details ↗</button></div>}</div></article>)}</div> : <div className="market-empty"><h3>No paintings here yet.</h3><p>{view === 'market' ? 'Try changing your filters, or return when artists have listed their work.' : view === 'mine' ? 'Share your first painting with the community.' : 'Save a painting to find it here later.'}</p>{view === 'mine' && <button className="primary-button" onClick={openSell}>Create a listing</button>}</div>}
        {view === 'market' && pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>← Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>}
      </section>
      {user && view === 'mine' && <section className="container inquiry-section"><div className="section-heading"><div><p className="eyebrow">Buyer interest</p><h2>Contact requests</h2></div></div>{inquiries.length ? inquiries.map(item => <div className="inquiry-row" key={item.id}><span><strong>{item.buyer.name}</strong> asked about {item.painting.title}</span><a href={'mailto:' + item.buyer.email}>{item.buyer.email}</a></div>) : <p className="market-muted">No one has requested contact yet.</p>}</section>}
    </main><footer className="market-footer"><div className="container"><span className="wordmark">lumière<span>®</span></span><p>Original paintings. Real connections.</p><small>© {new Date().getFullYear()} Lumière · Prices in EGP · Transactions are arranged directly with sellers.</small></div></footer>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    {authMode && <AuthDialog mode={authMode} setMode={setAuthMode} user={user} savedCount={favorites.length} onClose={() => { setAuthMode(null); setAfterAuth(null); }} onAuthenticated={data => { setUser(data.user); setAuthMode(null); if (afterAuth) afterAuth(); setAfterAuth(null); }} onLogout={() => { setUser(null); setView('market'); setAuthMode(null); }} onViewSaved={() => { setView('saved'); setAuthMode(null); }} onViewListings={() => { setView('mine'); setAuthMode(null); }} />}
    {editing !== undefined && <ListingForm painting={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice('Listing saved.'); loadMarket(); loadPrivate(); }} />}
    {selected && <PaintingDetail key={selected.id} painting={selected} user={user} saved={favorites.some(item => item.id === selected.id)} onSave={toggleFavorite} onClose={() => setSelected(null)} onLogin={() => { setSelected(null); gate(() => setSelected(selected)); }} />}
  </div>;
}
