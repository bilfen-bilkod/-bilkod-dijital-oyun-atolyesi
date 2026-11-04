(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = "bilkod-yeni-yayin-draft-v2";
  const ISSUE_FORM = "https://github.com/bilfen-bilkod/-bilkod-dijital-oyun-atolyesi/issues/new";
  const VALID_CATEGORIES = ["Kodlama", "Algoritma", "Dikkat ve Hafıza", "Sanat ve Tasarım", "Yapboz", "Tasarım ve İnşa", "Diğer"];
  let knownGames = [];
  let loadingDone = false;
  function showStatus(message, isError = false) {
    $("formMessage").textContent = message;
    $("formMessage").style.color = isError ? "#ba2550" : "#0a6ba8";
  }
  function normalizeGameUrl(value) {
    let url;
    try { url = new URL(String(value).trim()); }
    catch { throw new Error("Geçerli bir GitHub veya GitHub Pages bağlantısı girin."); }
    if (url.protocol !== "https:") throw new Error("Oyun bağlantısı https:// ile başlamalı.");
    if (url.hostname.toLowerCase() === "github.com") {
      const match = url.pathname.match(/^\/bilfen-bilkod\/([a-z0-9._-]+)(?:\/settings\/pages)?\/?$/i);
      if (!match) throw new Error("Lütfen bilfen-bilkod hesabındaki oyunun depo bağlantısını veya Settings / Pages adresini girin.");
      url = new URL("https://bilfen-bilkod.github.io/" + match[1] + "/");
    }
    if (url.hostname.toLowerCase() !== "bilfen-bilkod.github.io" || !/^\/[a-z0-9._-]+\/?$/i.test(url.pathname) || url.search || url.hash || url.port || url.username || url.password) {
      throw new Error("Oyun adresi https://bilfen-bilkod.github.io/oyun-adi/ biçiminde olmalıdır.");
    }
    return "https://bilfen-bilkod.github.io/" + url.pathname.split("/")[1] + "/";
  }
  function safeGameLink(value) {
    try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; }
    catch { return null; }
  }
  function selectedCover() {
    if ($("gameCover").value !== "custom") return $("gameCover").value;
    const raw = $("gameCoverUrl").value.trim();
    if (!raw) throw new Error("Özel kapak için herkese açık bir HTTPS görsel bağlantısı girin.");
    let url;
    try { url = new URL(raw); } catch { throw new Error("Kapak bağlantısı geçerli değil."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Kapak görseli HTTPS bağlantısı olmalıdır.");
    return url.href;
  }
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title: $("gameTitle").value,
        url: $("gameUrl").value,
        category: $("gameCategory").value,
        ages: [...document.querySelectorAll('input[name="age"]:checked')].map(e => e.value),
        description: $("gameDescription").value,
        cover: $("gameCover").value,
        customCoverUrl: $("gameCoverUrl").value
      }));
    } catch { /* Cihaz gizli modda olabilir. */ }
  }
  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!draft || typeof draft !== "object") return;
      if (typeof draft.title === "string") $("gameTitle").value = draft.title;
      if (typeof draft.url === "string") $("gameUrl").value = draft.url;
      if (VALID_CATEGORIES.includes(draft.category)) $("gameCategory").value = draft.category;
      if (typeof draft.description === "string") $("gameDescription").value = draft.description;
      if ([...$("gameCover").options].some(o => o.value === draft.cover)) $("gameCover").value = draft.cover;
      if (typeof draft.customCoverUrl === "string") $("gameCoverUrl").value = draft.customCoverUrl;
      const ages = Array.isArray(draft.ages) ? draft.ages : [];
      for (const el of document.querySelectorAll('input[name="age"]')) el.checked = ages.includes(el.value);
      $("customCoverField").hidden = $("gameCover").value !== "custom";
    } catch { /* Bozuk eski taslak yok sayılır. */ }
  }
  $("gameCover").addEventListener("change", () => {
    $("customCoverField").hidden = $("gameCover").value !== "custom";
    saveDraft();
  });
  $("publishGameForm").addEventListener("input", saveDraft);
  $("publishGameForm").addEventListener("change", saveDraft);
  $("publishGameForm").addEventListener("reset", () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    $("githubReady").classList.remove("show");
    setTimeout(() => {
      $("customCoverField").hidden = true;
      showStatus("");
    }, 0);
  });
  $("publishGameForm").addEventListener("submit", event => {
    event.preventDefault();
    $("githubReady").classList.remove("show");
    const title = $("gameTitle").value.trim();
    if (!title || title.length > 90) {
      showStatus("Oyun adını yazın (en fazla 90 karakter).", true);
      $("gameTitle").focus();
      return;
    }
    try {
      const url = normalizeGameUrl($("gameUrl").value);
      if (knownGames.some(g => g && String(g.url || "").replace(/\/+$/, "").toLowerCase() === url.replace(/\/+$/, "").toLowerCase())) {
        showStatus("Bu oyun zaten BİLKOD listesinde kayıtlı. Farklı bir oyunu ekleyin.", true);
        return;
      }
      const category = $("gameCategory").value;
      if (!VALID_CATEGORIES.includes(category)) throw new Error("Geçerli bir kategori seçin.");
      const ages = [...document.querySelectorAll('input[name="age"]:checked')].map(el => el.value);
      const description = $("gameDescription").value.trim().replace(/\s+/g, " ");
      if (description.length > 180) throw new Error("Açıklama en fazla 180 karakter olabilir.");
      const cover = selectedCover();
      const params = new URLSearchParams({
        template: "yeni-oyun.yml",
        title: "[BİLKOD OYUN] " + title,
        oyun_adi: title,
        oyun_baglantisi: url,
        kategori: category,
        yas_gruplari: ages.join(", "),
        aciklama: description,
        kapak_gorseli: cover
      });
      const approvalUrl = ISSUE_FORM + "?" + params.toString();
      $("githubFallback").href = approvalUrl;
      $("githubReady").classList.add("show");
      $("gameUrl").value = url;
      showStatus("Oyun bilgileri hazır. Açılan GitHub sekmesinde Submit new issue butonuyla onaylayın.");
      saveDraft();
      const popup = window.open(approvalUrl, "_blank");
      if (popup) popup.opener = null;
    } catch (error) {
      showStatus(error.message || "Bağlantıyı ve oyun bilgilerini kontrol edin.", true);
    }
  });
  async function loadGames() {
    try {
      const response = await fetch("oyunlar.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Oyun listesi okunamadı");
      const json = await response.json();
      if (!Array.isArray(json.games)) throw new Error("Oyun listesi bozuk");
      knownGames = json.games;
      const published = knownGames.filter(g => g.published !== false);
      $("gameCount").textContent = String(published.length);
      const container = $("liveGames");
      container.replaceChildren();
      for (const game of published.slice().reverse()) {
        const link = document.createElement("a");
        const href = safeGameLink(game.url);
        if (!href) continue;
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const title = document.createElement("span");
        title.textContent = String(game.title || "Oyun");
        const note = document.createElement("small");
        note.textContent = game.isNew ? "Yeni ↗" : "Oyuna Git ↗";
        link.append(title,note);
        container.appendChild(link);
      }
      loadingDone = true;
    } catch {
      $("gameCount").textContent = "—";
      $("liveGames").textContent = "Site listesi şu anda okunamadı. GitHub yayınlama durumunu kontrol edebilirsiniz.";
    }
    try {
      const prior = JSON.parse(localStorage.getItem("bilkod-oyun-draft-v1") || "null");
      if (Array.isArray(prior) && loadingDone && prior.some(g => g && !knownGames.some(k => k.id === g.id))) {
        const msg = document.createElement("p");
        msg.className = "publisher-note";
        msg.textContent = "Bu tarayıcıda önceki yönetim ekranından oyun taslağı bulunuyor. Gelişmiş oyun düzenleme bağlantısından taslaklarınıza ulaşabilirsiniz.";
        $("liveGames").after(msg);
      }
    } catch {}
  }
  restoreDraft();
  loadGames();
})();