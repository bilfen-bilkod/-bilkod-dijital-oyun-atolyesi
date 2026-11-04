/* BILKOD Dijital Oyun Atolyesi - statik GitHub Pages surumu */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeLink = (candidate) => {
    try { const url = new URL(candidate, window.location.href); return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost') ? url.href : '#'; }
    catch { return '#'; }
  };
  const safeCover = (candidate) => {
    if (!candidate) return 'assets/covers/yeni-oyun.svg';
    if (/^assets\/covers\/[a-z0-9-]+\.svg$/i.test(candidate)) return candidate;
    if (/^https:\/\//i.test(candidate)) return candidate;
    return 'assets/covers/yeni-oyun.svg';
  };
  let games = [], currentCategory = 'Tümü', favoritesOnly = false, searchQuery = '';
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('bilkod-favoriler') || '[]')); } catch {}
  let toastTimer;
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }
  function gameHref(game) { return safeLink(game.url); }
  function renderLatestCard(game) {
    return `<article class="latest-card"><div class="latest-image"><img src="${safeText(safeCover(game.cover))}" alt="${safeText(game.title)} oyun görseli"><span class="new-badge">YENİ ✦</span></div><div class="latest-card-body"><span class="card-category">${safeText(game.category)}</span><h3>${safeText(game.title)}</h3><p>${safeText(game.description)}</p><a class="button button-primary" href="${safeText(gameHref(game))}" target="_blank" rel="noopener noreferrer" aria-label="${safeText(game.title)} oyununu yeni sekmede aç">Oyuna Git <svg class="icon"><use href="#icon-arrow"/></svg></a></div></article>`;
  }
  function renderGameCard(game) {
    const fav = favorites.has(game.id);
    return `<article class="game-card">${game.isNew ? '<span class="card-new-dot">YENİ</span>' : ''}<img class="game-cover" src="${safeText(safeCover(game.cover))}" alt="${safeText(game.title)} oyun görseli"><div class="game-card-content"><span class="card-category">${safeText(game.category)}</span><h3>${safeText(game.title)}</h3><p class="game-card-desc">${safeText(game.description)}</p><div class="game-card-footer"><a class="button button-primary" href="${safeText(gameHref(game))}" target="_blank" rel="noopener noreferrer" aria-label="${safeText(game.title)} oyununu yeni sekmede aç">Oyuna Git <svg class="icon"><use href="#icon-arrow"/></svg></a><button type="button" class="icon-action${fav ? ' favorited' : ''}" data-fav="${safeText(game.id)}" aria-label="${fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}: ${safeText(game.title)}" aria-pressed="${fav}" title="${fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}"><svg class="icon"><use href="#icon-heart"/></svg></button><button type="button" class="icon-action" data-copy="${safeText(game.id)}" aria-label="${safeText(game.title)} bağlantısını kopyala" title="Bağlantıyı kopyala"><svg class="icon"><use href="#icon-link"/></svg></button></div></div></article>`;
  }
  function renderCategories() {
    const cats = ['Tümü', ...new Set(games.map(g => g.category))];
    $('#categoryFilters').innerHTML = cats.map(c => `<button type="button" class="filter-pill${currentCategory === c ? ' active' : ''}" data-category="${safeText(c)}" aria-pressed="${currentCategory === c}">${c === 'Tümü' ? 'Tüm Oyunlar' : safeText(c)}</button>`).join('');
  }
  function render() {
    const filtered = games.filter(g => {
      const matchesCategory = currentCategory === 'Tümü' || g.category === currentCategory;
      const matchesFavorite = !favoritesOnly || favorites.has(g.id);
      const combined = `${g.title} ${g.description} ${g.category}`.toLocaleLowerCase('tr-TR');
      return matchesCategory && matchesFavorite && combined.includes(searchQuery.toLocaleLowerCase('tr-TR'));
    });
    $('#gamesGrid').innerHTML = filtered.map(renderGameCard).join('');
    $('#emptyState').hidden = filtered.length > 0;
    $('#resultCount').textContent = `${filtered.length} oyun gösteriliyor · Toplam ${games.length} oyun`;
    $('#resetFilters').hidden = currentCategory === 'Tümü' && !favoritesOnly && !searchQuery;
    $('#favoritesFilter').classList.toggle('active', favoritesOnly);
    $('#favoritesFilter').setAttribute('aria-pressed', String(favoritesOnly));
    renderCategories();
  }
  function resetFilters() {
    currentCategory = 'Tümü'; favoritesOnly = false; searchQuery = ''; $('#searchInput').value = ''; render();
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Oyun bağlantısı kopyalandı!');
    } catch {
      const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input);
      input.select(); const ok = document.execCommand('copy'); input.remove();
      toast(ok ? 'Oyun bağlantısı kopyalandı!' : 'Bağlantı kopyalanamadı.');
    }
  }
  async function loadGames() {
    let source = window.BILKOD_YEDEK_OYUNLAR || [];
    try {
      const response = await fetch('oyunlar.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Liste alinamadi');
      const json = await response.json(); if (!Array.isArray(json.games)) throw new Error('Liste hatali');
      source = json.games;
    } catch { /* Yerel index.html onizlemesi icin yedek oyun listesi kullanilir. */ }
    games = source.filter(g => g && g.published !== false && /^https:\/\//i.test(g.url || ''));
    const latest = games.filter(g => g.isNew).slice(-3).reverse();
    const shown = latest.length ? latest : games.slice(-3).reverse();
    $('#latestGrid').innerHTML = shown.length ? shown.map(renderLatestCard).join('') : '<p class="load-message">Henüz oyun eklenmedi.</p>';
    render();
  }
  $('#categoryFilters').addEventListener('click', event => {
    const btn = event.target.closest('[data-category]'); if (!btn) return;
    currentCategory = btn.dataset.category; render();
  });
  $('#searchInput').addEventListener('input', event => { searchQuery = event.target.value.trim(); render(); });
  $('#favoritesFilter').addEventListener('click', () => { favoritesOnly = !favoritesOnly; render(); });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#emptyReset').addEventListener('click', resetFilters);
  $('#gamesGrid').addEventListener('click', event => {
    const favBtn = event.target.closest('[data-fav]');
    if (favBtn) {
      const id = favBtn.dataset.fav;
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      try { localStorage.setItem('bilkod-favoriler', JSON.stringify([...favorites])); } catch {}
      render(); toast(favorites.has(id) ? 'Oyun favorilere eklendi ★' : 'Oyun favorilerden çıkarıldı');
      return;
    }
    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) { const game = games.find(g => g.id === copyBtn.dataset.copy); if (game) copyText(game.url); }
  });
  $('#menuBtn').addEventListener('click', () => {
    const menu = $('#menu'); const open = menu.classList.toggle('open');
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.header-nav a').forEach(a => a.addEventListener('click', () => {
    $('#menu').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  }));
  $('#fullscreenBtn').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); toast('Tam ekran kapatıldı'); }
      else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); toast('Tam ekran açıldı'); }
      else { toast('Bu tarayıcıda tam ekran kullanılamıyor'); }
    } catch { toast('Tarayıcı tam ekran isteğini kabul etmedi'); }
  });
  loadGames();
})();
