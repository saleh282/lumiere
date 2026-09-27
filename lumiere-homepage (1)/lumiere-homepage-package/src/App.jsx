import React, { useEffect, useRef, useState } from 'react';
import { artworks } from './artworks.js';
import { apiRequest, guestFavorites } from './api.js';
import AuthDialog from './components/AuthDialog.jsx';
import { BrowseEdits, ArtistSpotlights, Journal, MembershipBanner } from './components/Discover.jsx';

const money = value => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value);
const categories = ['All works', ...new Set(artworks.map(art => art.category)), 'Available'];

function Arrow({ diagonal = false }) { return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>; }
function Heart({ filled = false }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
}
function ArtworkImage({ art, eager = false }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="image-fallback"><span aria-hidden="true">▧</span>{art.title}<small>Image unavailable</small></span> :
    <img src={art.image} alt={`${art.title} by ${art.artist}`} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}
function ArtworkCard({ art, index, saved, onSave, onOpen }) {
  return <article className="art-card">
    <div className={`art-stage tone-${index % 3}`}>
      <button className="art-open" onClick={() => onOpen(art)} aria-label={`View details of ${art.title}`}>
        <span className={`art-frame ${art.category === 'Portraits' || art.orientation === 'portrait' ? 'portrait' : 'landscape'}`}><ArtworkImage art={art} /></span>
        <span className="view-art">Take a closer look <Arrow diagonal /></span>
      </button>
      <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={() => onSave(art.title)} aria-label={`${saved ? 'Unsave' : 'Save'} ${art.title}`} aria-pressed={saved}><Heart filled={saved} /></button>
      {!art.available && <span className="sold-out">Sold out</span>}
    </div>
    <div className="card-info">
      <p className="artist">{art.artist}<span>{art.year}</span></p>
      <h3><button onClick={() => onOpen(art)}>{art.title}</button></h3>
      <p className="art-description">{art.description}</p>
      <div className="card-bottom"><div><span className="price">{money(art.price)}</span><span className="print-label">Art print · 40 × 50 cm</span></div><button className="round-arrow" aria-label={`Explore ${art.title}`} onClick={() => onOpen(art)}><Arrow diagonal /></button></div>
    </div>
  </article>;
}
function ArtworkDialog({ art, saved, onSave, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; element.close(); };
  }, []);
  return <dialog ref={dialog} className="art-dialog" aria-labelledby="art-title" onClose={() => { if (!dialog.current?.open) onClose(); }} onClick={event => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <button className="dialog-close" onClick={onClose} aria-label="Close artwork details" autoFocus>×</button>
    <div className="dialog-art"><ArtworkImage art={art} eager /></div>
    <div className="dialog-copy"><p className="eyebrow">{art.category} / {art.year}</p><h2 id="art-title">{art.title}</h2><p className="dialog-artist">{art.artist}</p><p className="body-copy">{art.description}</p>
      <dl><div><dt>Format</dt><dd>Art print, unframed</dd></div><div><dt>Dimensions</dt><dd>40 × 50 cm</dd></div><div><dt>Availability</dt><dd>{art.available ? 'Available print' : 'Sold out'}</dd></div></dl>
      <p className="dialog-price">{money(art.price)}</p><button className="primary-button" onClick={() => onSave(art.title)} aria-pressed={saved}><Heart filled={saved} />{saved ? 'Saved to your collection' : 'Save to your collection'}</button>
      <p className="demo-note">Sample print price. The original painting is not for sale.</p><a className="text-link" href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(art.file)}`} target="_blank" rel="noreferrer">Artwork source & attribution <Arrow diagonal /></a>
    </div>
  </dialog>;
}
export default function App() {
  const [category, setCategory] = useState('All works');
  const [sort, setSort] = useState('curated');
  const [query, setQuery] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(guestFavorites);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const accountEpoch = useRef(0);
  useEffect(() => {
    let active = true;
    apiRequest('/me').then(data => { if (active) { setUser(data.user); if (data.user) setSaved(data.favorites); } })
      .catch(() => { if (active) setNotice('Account service is unavailable. You can still explore the gallery.'); })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (authReady && !user) { try { localStorage.setItem('lumiere-saved', JSON.stringify(saved)); } catch {} }
  }, [saved, user, authReady]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function toggleSave(title) {
    if (!authReady) { setNotice('Connecting to your collection. Please try again in a moment.'); return; }
    if (saving.current) return;
    const next = saved.includes(title) ? saved.filter(item => item !== title) : [...saved, title];
    if (!user) { setSaved(next); return; }
    saving.current = true;
    const epoch = accountEpoch.current;
    try {
      const data = await apiRequest('/favorites', { method: 'PUT', body: JSON.stringify({ favorites: next }) });
      if (epoch === accountEpoch.current) setSaved(data.favorites);
    } catch (error) {
      if (error.status === 401 && epoch === accountEpoch.current) {
        accountEpoch.current++; setUser(null); setSaved(guestFavorites()); setAuthMode('login');
      }
      setNotice(error.message);
    } finally { saving.current = false; }
  }
  function authenticated(data) {
    accountEpoch.current++;
    setUser(data.user); setSaved(data.favorites); setAuthMode(null);
    setNotice('Welcome, ' + data.user.name.split(' ')[0] + '. Your collection is ready.');
  }
  function loggedOut() {
    accountEpoch.current++;
    setUser(null); setSaved(guestFavorites()); setSavedOnly(false); setAuthMode(null);
    setNotice('You have been signed out.');
  }
  function exploreCategory(name) {
    setCategory(name); setQuery(''); setSavedOnly(false);
    document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
  }
  function exploreArtist(name) {
    setCategory('All works'); setQuery(name); setSavedOnly(false);
    document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' });
  }
  const search = query.trim().toLocaleLowerCase();
  const visible = artworks.filter(art =>
    (category === 'All works' || (category === 'Available' ? art.available : art.category === category)) &&
    (!savedOnly || saved.includes(art.title)) &&
    (!search || (art.title + ' ' + art.artist + ' ' + art.category).toLocaleLowerCase().includes(search))
  );
  if (sort === 'price-low') visible.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') visible.sort((a, b) => b.price - a.price);

  return <>
    <a className="skip-link" href="#collection">Skip to collection</a>
    <div className="announcement">A little art. A different everyday. <span>Discover the collection <Arrow diagonal /></span></div>
    <header className="site-header container">
      <a href="#" className="wordmark" aria-label="Lumière home">lumière<span>®</span></a>
      <nav aria-label="Main navigation"><a href="#collection">Collection</a><a href="#artists">Artists</a><a href="#journal">Journal</a><a href="#story">Our story</a></nav>
      <div className="header-actions"><a href="#collection" className={`saved-link ${savedOnly ? 'is-active' : ''}`} onClick={() => { setSavedOnly(value => !value); setCategory('All works'); setQuery(''); }} aria-label={savedOnly ? 'Show all artworks' : `Show saved artworks (${saved.length})`}><Heart filled={savedOnly} /><span className="saved-count">{saved.length}</span></a>
      <button className="account-button" disabled={!authReady} onClick={() => setAuthMode(user ? 'account' : 'register')}>{!authReady ? 'Loading…' : user ? user.name.split(' ')[0] + ' ↗' : 'Join Lumière ↗'}</button></div>
    </header>
    <main>
      <section className="hero container" aria-labelledby="hero-heading">
        <div className="hero-copy"><p className="eyebrow"><span className="tiny-line" /> A considered collection of art</p><h1 id="hero-heading">Some things<br />just <em>feel like you.</em></h1><p className="hero-description">A quiet corner. A favorite color. A painting you keep coming back to. Find a little art to make your space your own.</p><a className="primary-button" href="#collection">Explore the collection <Arrow /></a><div className="hero-footnote"><span className="sparkle" aria-hidden="true">✳</span><span>Timeless works. Remarkable artists.<br /><strong>A new point of view for your walls.</strong></span></div></div>
        <div className="hero-exhibit"><span className="exhibit-label">THE LUMIÈRE EDIT — VOL. 01</span><div className="exhibit-art"><button className="hero-landscape art-frame" onClick={() => setSelected(artworks[0])} aria-label="Explore The Starry Night"><ArtworkImage art={artworks[0]} eager /></button><button className="hero-portrait art-frame" onClick={() => setSelected(artworks[2])} aria-label="Explore Girl with a Pearl Earring"><ArtworkImage art={artworks[2]} eager /></button></div><div className="exhibit-caption"><span>Old masters.<br /><em>New surroundings.</em></span><span className="exhibit-number">01 / {String(artworks.length).padStart(2, '0')}</span></div></div>
      </section>
      <div className="collection-intro container"><span>Art with a story</span><span className="intro-dot">·</span><span>Details worth discovering</span><span className="intro-dot">·</span><span>A space that feels like home</span></div>
      <BrowseEdits onSelect={exploreCategory} />
      <section className="collection container" id="collection" aria-labelledby="collection-heading">
        <div className="section-heading"><div><p className="eyebrow">Find your next favorite</p><h2 id="collection-heading">The collection<span>({String(artworks.length).padStart(2, '0')})</span></h2></div><p>Different stories. Different perspectives.<br />One thoughtfully curated collection.</p></div>
        <div className="collection-toolbar"><div className="filters" role="group" aria-label="Filter artworks">{categories.map(name => <button key={name} aria-pressed={category === name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div><label className="sort-control">Sort by <select value={sort} onChange={event => setSort(event.target.value)}><option value="curated">Curated order</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        <div className="search-row"><label className="search-box"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" aria-label="Search artworks or artists" placeholder="Find a painting, artist, or mood…" value={query} onChange={event => setQuery(event.target.value)} /></label>{query && <button className="clear-search" onClick={() => setQuery('')}>Clear search ×</button>}</div>
        <div className="results-line"><p role="status">{visible.length} {savedOnly ? 'saved ' : ''}artwork{visible.length === 1 ? '' : 's'}</p>{savedOnly && <button onClick={() => setSavedOnly(false)}>Show all works ×</button>}<span>Art prints · Prices in EGP</span></div>
        <div className="gallery-grid">{visible.map(art => <ArtworkCard key={art.title} art={art} index={artworks.indexOf(art)} saved={saved.includes(art.title)} onSave={toggleSave} onOpen={setSelected} />)}</div>
        {!visible.length && <div className="empty-state"><Heart /><h3>A little room for inspiration.</h3><p>{savedOnly ? 'Tap the heart on a painting to save it here.' : 'No artworks match this selection. Try a different artist or title.'}</p><button className="text-link" onClick={() => { setCategory('All works'); setSavedOnly(false); setQuery(''); }}>Explore all works <Arrow /></button></div>}
        <p className="catalog-note">A sample collection of art prints. Prices and availability are illustrative.</p>
      </section>
      <ArtistSpotlights onSelect={exploreArtist} />
      <section className="story container" id="story"><div className="story-art"><div className="art-frame"><ArtworkImage art={artworks[1]} /></div><span>Hokusai, c. 1831 — a moment, made timeless.</span></div><div className="story-copy"><p className="eyebrow">The Lumière perspective</p><h2>Good art doesn't just<br />fill a wall.<br /><em>It makes a room.</em></h2><p className="body-copy">We believe living with art should feel personal. A familiar landscape, an unexpected detail, a color that stays with you — the right piece is the one that makes you feel something.</p><a className="text-link" href="#collection">Find your connection <Arrow /></a></div></section>
      <Journal />
      <MembershipBanner user={user} onJoin={() => setAuthMode(user ? 'account' : 'register')} />
      <section className="closing container"><span className="sparkle" aria-hidden="true">✳</span><p>Make room for something you love.</p><a href="#collection">Discover your next favorite <Arrow diagonal /></a></section>
    </main>
    <footer className="container expanded-footer"><div className="footer-brand"><a className="wordmark" href="#">lumière<span>®</span></a><p>Art for the everyday.<br />A little inspiration, a little more you.</p><img src="/artworks/water-lily-pond.jpg" alt="Detail from Monet's Water Lily Pond" loading="lazy" /></div><div><h3>Discover</h3><a href="#collection">The collection</a><a href="#edits">Browse by mood</a><a href="#artists">The artists</a></div><div><h3>Make it yours</h3><button onClick={() => setAuthMode(user ? 'account' : 'register')}>{user ? 'My account' : 'Create an account'}</button>{!user && <button onClick={() => setAuthMode('login')}>Sign in</button>}<a href="#journal">The journal</a><a href="#story">Our perspective</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Lumière · Cairo, Egypt</span><span>Art prints. Sample prices in EGP.</span><a href="#">Back to top ↑</a></div></footer>
    {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {authMode && <AuthDialog mode={authMode} setMode={setAuthMode} user={user} savedCount={saved.length} onClose={() => setAuthMode(null)} onAuthenticated={authenticated} onLogout={loggedOut} onViewSaved={() => { setAuthMode(null); setCategory('All works'); setQuery(''); setSavedOnly(true); document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }); }} />}
    {selected && <ArtworkDialog key={selected.title} art={selected} saved={saved.includes(selected.title)} onSave={toggleSave} onClose={() => setSelected(null)} />}
  </>;
}

