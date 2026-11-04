(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const draftKey = 'bilkod-oyun-draft-v1';
  const defaultCover = 'assets/covers/yeni-oyun.svg';
  let games = [], originalGames = [];
  const knownCovers = [...$('gameCover').options].map(o=>o.value).filter(v=>v!=='custom');
  function safeCover(src) { return knownCovers.includes(src) || /^https:\/\//i.test(src||'') ? src : defaultCover; }
  function makeSlug(value) {
    return String(value).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64) || 'oyun';
  }
  function setStatus(message, error=false) { $('formMessage').textContent = message; $('formMessage').style.color = error ? '#b52657' : '#0b6eae'; }
  function saveDraft() { try{localStorage.setItem(draftKey, JSON.stringify(games));}catch{} }
  function renderList() {
    $('adminCount').textContent=`(${games.length})`;
    $('adminList').innerHTML=games.length ? games.map((g,i)=>`<div class="admin-item"><img src="${esc(safeCover(g.cover))}" alt="" loading="lazy"><div class="admin-item-info"><strong>${esc(g.title)}</strong><small>${esc(g.category)}${g.published===false ? ' · Gizli' : ''}${g.isNew ? ' · Yeni' : ''}</small></div><div class="admin-item-actions"><button class="admin-small-btn" type="button" data-edit="${i}" aria-label="${esc(g.title)} oyununu düzenle">Düzenle</button><button class="admin-small-btn danger" type="button" data-remove="${i}" aria-label="${esc(g.title)} oyununu sil">Sil</button></div></div>`).join('') : '<p>Henüz oyun yok.</p>';
  }
  function resetForm() {
    $('gameForm').reset(); $('editingId').value=''; $('gameNew').checked=true; $('gamePublished').checked=true;
    $('gameCover').value=defaultCover; $('customCoverField').hidden=true;
    $('formTitle').textContent='Yeni Oyun Ekle'; $('saveGame').textContent='Oyunu Listeye Kaydet'; setStatus('');
  }
  function editGame(index) {
    const g=games[index];if(!g)return;
    $('editingId').value=String(index);
    $('gameTitle').value=g.title;
    $('gameUrl').value=g.url;
    $('gameCategory').value=g.category;
    if($('gameCategory').value!==g.category) $('gameCategory').value='Diğer';
    $('gameAges').value=Array.isArray(g.ageGroups)?g.ageGroups.join(', '):'';
    $('gameDescription').value=g.description||'';
    const isTemplate=knownCovers.includes(g.cover);
    $('gameCover').value=isTemplate?g.cover:'custom';
    $('customCoverField').hidden=isTemplate;
    $('gameCoverUrl').value=isTemplate?'':(g.cover||'');
    $('gameNew').checked=Boolean(g.isNew); $('gamePublished').checked=g.published!==false;
    $('formTitle').textContent='Oyunu Düzenle'; $('saveGame').textContent='Değişiklikleri Kaydet';
    setStatus(`“${g.title}” düzenleniyor.`);
    window.scrollTo({top:0,behavior:'smooth'});
    $('gameTitle').focus();
  }
  $('gameCover').addEventListener('change', () => { $('customCoverField').hidden = $('gameCover').value !== 'custom'; });
  $('gameForm').addEventListener('submit', event => {
    event.preventDefault();
    const title=$('gameTitle').value.trim(), urlString=$('gameUrl').value.trim();
    if(!title){setStatus('Lütfen oyunun adını yazın.',true);$('gameTitle').focus();return;}
    let url;
    try { url=new URL(urlString); if(url.protocol!=='https:') throw new Error('https gerekli'); }
    catch { setStatus('Lütfen https:// ile başlayan geçerli bir oyun bağlantısı yazın.',true); $('gameUrl').focus(); return; }
    const custom=$('gameCover').value==='custom';
    const cover=custom ? $('gameCoverUrl').value.trim() : $('gameCover').value;
    if(custom&&!/^https:\/\S+$/i.test(cover)) { setStatus('Özel kapak görseli için https:// adresi girin.',true);return; }
    const idx=$('editingId').value===''?-1:Number($('editingId').value);
    const id=idx>=0 ? games[idx].id : makeSlug(title)+'-'+Math.random().toString(36).slice(2,7);
    const ageGroups=$('gameAges').value.split(',').map(s=>s.trim()).filter(Boolean);
    const record={id,title,description:$('gameDescription').value.trim(),category:$('gameCategory').value,ageGroups,url:url.href,cover:cover||defaultCover,addedAt:idx>=0?games[idx].addedAt:new Date().toISOString().slice(0,10),isNew:$('gameNew').checked,published:$('gamePublished').checked};
    if(idx>=0) games[idx]=record; else games.push(record);
    saveDraft();renderList();resetForm();setStatus(idx>=0?'Oyun taslak listede güncellendi. Yayınlamak için JSON dosyasını indirin.':'Yeni oyun taslak listeye eklendi. Yayınlamak için JSON dosyasını indirin.');
  });
  $('adminList').addEventListener('click',event=>{
    const edit=event.target.closest('[data-edit]'); if(edit){editGame(Number(edit.dataset.edit));return;}
    const remove=event.target.closest('[data-remove]'); if(remove){
      const index=Number(remove.dataset.remove);const game=games[index];
      if(game&&confirm(`“${game.title}” oyununu hazırlanan listeden kaldırmak istiyor musunuz?`)){
        games.splice(index,1);saveDraft();renderList();resetForm();setStatus('Oyun taslaktan kaldırıldı. Canlı sitede değişmesi için JSON dosyasını yayınlayın.');
      }
    }
  });
  $('cancelEdit').addEventListener('click',resetForm);
  $('downloadList').addEventListener('click',()=>{
    const payload=JSON.stringify({version:1,games},null,2);const blob=new Blob([payload],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='oyunlar.json';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    $('exportMessage').textContent='Dosya indirme işlemi başlatıldı. Şimdi GitHub deposundaki oyunlar.json ile değiştirin.';
  });
  $('resetDraft').addEventListener('click',()=>{
    if(!confirm('Taslakta yaptığınız tüm değişiklikler silinsin ve ilk oyun listesi geri gelsin mi?'))return;
    games=structuredClone(originalGames);saveDraft();renderList();resetForm();setStatus('Liste ilk haline döndürüldü.');
  });
  async function load(){
    let source=window.BILKOD_YEDEK_OYUNLAR||[];
    try{const r=await fetch('oyunlar.json',{cache:'no-store'});if(!r.ok)throw new Error('not found');const json=await r.json();if(Array.isArray(json.games))source=json.games;}catch{}
    originalGames=structuredClone(source);
    let hasDraft=false;
    try{const json=JSON.parse(localStorage.getItem(draftKey)||'null');if(Array.isArray(json)){games=json;hasDraft=true;}}catch{}
    if(!hasDraft)games=structuredClone(source);
    renderList();if(hasDraft)setStatus('Bu tarayıcıda saklanan oyun listesi taslağı yüklendi.');
  }
  load();
})();
