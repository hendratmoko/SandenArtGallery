/* ============================================================
 *  ADAPTER DATA
 *  - Mencoba ambil/simpan data lewat Google Apps Script (GAS_URL)
 *  - Kalau gagal / belum dikonfigurasi & USE_LOCAL_FALLBACK=true,
 *    otomatis pakai data.json sebagai data contoh (read-only demo)
 * ============================================================ */
window.dataSdk = (function () {
  const CFG = window.APP_CONFIG || {};
  let listener = null;
  let usingFallback = false;

  function isConfigured() {
    return CFG.GAS_URL && CFG.GAS_URL.indexOf('GANTI_DENGAN') !== 0;
  }

  function showLoading(on) {
    const el = document.getElementById('loading-banner');
    if (el) el.classList.toggle('hidden', !on);
  }

  function showOfflineBanner(on, message) {
    const el = document.getElementById('offline-banner');
    if (!el) return;
    if (message) el.textContent = message;
    el.classList.toggle('hidden', !on);
  }

  async function fetchFromGas() {
  console.log("URL =", CFG.GAS_URL);
  const res = await fetch(CFG.GAS_URL);
  console.log("status =", res.status);
  console.log("ok =", res.ok);
  const text = await res.text();
  console.log(text);
  const json = JSON.parse(text);
  if (!json.isOk)
      throw new Error(json.error);
  return json.data || [];
}
/*  async function fetchFromGas() {
    const res = await fetch(CFG.GAS_URL, { method: 'GET' });
    const json = await res.json();
    if (!json.isOk) throw new Error(json.error || 'Gagal memuat data dari server');
    return json.data || [];
  }
*/
  async function fetchFromLocal() {
    const res = await fetch(CFG.LOCAL_DATA_PATH || 'data.json');
    if (!res.ok) throw new Error('data.json tidak ditemukan');
    return await res.json();
  }

  async function init(handler) {
    listener = handler;
    showLoading(true);

    if (isConfigured()) {
      try {
        const data = await fetchFromGas();
        usingFallback = false;
        showOfflineBanner(false);
        listener.onDataChanged(data);
        showLoading(false);
        return { isOk: true };
      } catch (err) {
        console.error('Gagal mengambil data dari GAS:', err);
        if (!CFG.USE_LOCAL_FALLBACK) {
          showLoading(false);
          return { isOk: false, error: err.message };
        }
        // lanjut ke fallback di bawah
      }
    }

    // Mode fallback (GAS belum dikonfigurasi atau fetch gagal)
    try {
      const data = await fetchFromLocal();
      usingFallback = true;
      showOfflineBanner(true, '⚠️ Mode demo: menampilkan data.json (belum tersambung ke Google Sheet)');
      listener.onDataChanged(data);
      showLoading(false);
      return { isOk: true };
    } catch (err) {
      showLoading(false);
      console.error('Gagal memuat data fallback:', err);
      return { isOk: false, error: err.message };
    }
  }

  async function create(record) {
    if (usingFallback || !isConfigured()) {
      alert('Belum tersambung ke Google Sheet (GAS_URL belum aktif). Data ini tidak akan tersimpan permanen — cek config.js.');
      return { isOk: false, error: 'GAS belum dikonfigurasi' };
    }
    try {
      showLoading(true);
      const res = await fetch(CFG.GAS_URL, {
        method: 'POST',
        // text/plain menghindari CORS preflight yang tidak didukung Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'create', record })
      });
      const json = await res.json();
      if (!json.isOk) throw new Error(json.error || 'Gagal menyimpan data');

      const data = await fetchFromGas();
      if (listener) listener.onDataChanged(data);
      showLoading(false);
      return { isOk: true, data: json.data };
    } catch (err) {
      showLoading(false);
      console.error('dataSdk.create error:', err);
      alert('Gagal menyimpan data: ' + err.message + '\n\nPeriksa: 1) GAS_URL benar & diakhiri /exec, 2) deployment Apps Script "Who has access" = Anyone, 3) index.html dibuka via http/https bukan file://.');
      return { isOk: false, error: err.message };
    }
  }

  return { init, create };
})();

/* ============================================================
 *  LOGIKA GALERI
 * ============================================================ */
let allData = [], currentUser = null, quizData = [], quizIndex = 0, quizCorrect = 0, pendingWork = null, lang = 'id', currentTab = 'terbaru';

const i18n = {
  id: { empty: 'Belum ada karya. Jadilah yang pertama mengupload!', search: 'Cari nama/judul...' },
  en: { empty: 'No works yet. Be the first to upload!', search: 'Search name/title...' }
};

function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' • ' + n.toLocaleTimeString('id-ID');
}
setInterval(updateClock, 1000);
updateClock();

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}
if (localStorage.getItem('theme') !== 'light') document.body.classList.add('dark');

function toggleLang() {
  lang = lang === 'id' ? 'en' : 'id';
  document.getElementById('lang-btn').textContent = lang.toUpperCase();
  document.getElementById('search-input').placeholder = i18n[lang].search;
  renderGallery();
  renderTabs();
}

function showModal(n) { document.getElementById('modal-' + n).classList.remove('hidden'); }
function hideModal(n) { document.getElementById('modal-' + n).classList.add('hidden'); }
function showHelp() { showModal('help'); }

function generateCode(name) {
  const l = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'USR';
  return l + String(Math.floor(Math.random() * 900) + 100);
}

function getRank(score) {
  if (score >= 9) return { label: 'Diamond', cls: 'rank-diamond', textCls: 'text-gray-800' };
  if (score >= 6) return { label: 'Gold', cls: 'rank-gold', textCls: 'text-white' };
  if (score >= 3) return { label: 'Silver', cls: 'rank-silver', textCls: 'text-white' };
  if (score >= 1) return { label: 'Bronze', cls: 'rank-bronze', textCls: 'text-white' };
  return null;
}

const dataHandler = {onDataChanged(data) {
        // Menyimpan seluruh data
        allData = data;
        /* ===========================
           DASHBOARD STATISTIK
        =========================== */
        const totalKarya = allData.length;
        const totalGuru =allData.filter(x => x.status === "Guru").length;
        const totalSiswa =allData.filter(x => x.status === "Siswa").length;
        const totalMateri =allData.filter(x => x.status === "Guru").length;
        const totalKaryaSiswa =allData.filter(x => x.status === "Siswa").length;
        const totalKontributor =new Set(allData.map(x => x.name)).size;
        const totalBintang =allData.reduce((a, b) => a + Number(b.stars || 0), 0);
        const totalSertifikat =allData.filter(x => x.certified === true).length;
        const rataQuiz =allData.length
                ? (
                    allData.reduce((a, b) => a + Number(b.quiz_score || 0), 0)
                    / allData.length
                  ).toFixed(1)
                : 0;
        document.getElementById("totalKarya").textContent = totalKarya;
        document.getElementById("totalGuru").textContent = totalGuru;
        document.getElementById("totalSiswa").textContent = totalSiswa;
        document.getElementById("totalMateri").textContent = totalMateri;
        document.getElementById("totalKaryaSiswa").textContent = totalKaryaSiswa;
        document.getElementById("totalKontributor").textContent = totalKontributor;
        // Jika nanti ditambahkan di HTML
        if(document.getElementById("totalBintang"))
            document.getElementById("totalBintang").textContent = totalBintang;
        if(document.getElementById("totalSertifikat"))
            document.getElementById("totalSertifikat").textContent = totalSertifikat;
        if(document.getElementById("rataQuiz"))
            document.getElementById("rataQuiz").textContent = rataQuiz;
        /* ===========================
           RENDER WEBSITE
        =========================== */
        renderGallery();
        renderChart();
        renderTabs();}};

async function initApp() {
  const r = await window.dataSdk.init(dataHandler);
  if (!r.isOk) console.error('SDK init failed:', r.error);
  if (window.lucide) lucide.createIcons();
}
initApp();

// Chart
function renderChart() {
  const works = allData.filter(d => d.work_type === 'work' && d.submitted_at);
  const months = {};
  works.forEach(w => { const d = new Date(w.submitted_at); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); months[k] = (months[k] || 0) + 1; });
  const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const canvas = document.getElementById('perf-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 700 * dpr; canvas.height = 200 * dpr; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, 700, 200);
  if (sorted.length === 0) return;
  const max = Math.max(...sorted.map(s => s[1]), 1);
  const barW = Math.min(40, 600 / sorted.length - 8);
  const startX = 50;
  const isDark = document.body.classList.contains('dark');
  ctx.fillStyle = isDark ? '#8a9bb5' : '#5a6a7a'; ctx.font = '11px Libre Franklin';
  sorted.forEach(([label, val], i) => {
    const x = startX + i * (barW + 8);
    const h = (val / max) * 150;
    ctx.fillStyle = isDark ? '#60a5fa' : '#2563eb';
    ctx.fillRect(x, 180 - h, barW, h);
    ctx.fillStyle = isDark ? '#8a9bb5' : '#5a6a7a';
    ctx.fillText(label.slice(5), x, 195);
    ctx.fillText(val, x + barW / 2 - 4, 175 - h);
  });
}

// Tabs
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-terbaru').classList.toggle('tab-active', tab === 'terbaru');
  document.getElementById('tab-terpopuler').classList.toggle('tab-active', tab === 'terpopuler');
  renderTabs();
}

function renderTabs() {
  const works = allData.filter(d => d.work_type === 'work');
  const now = new Date(); const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let list;
  if (currentTab === 'terbaru') {
    list = [...works].filter(w => w.submitted_at && w.submitted_at.startsWith(curMonth)).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)).slice(0, 4);
  } else {
    list = [...works].filter(w => w.submitted_at && w.submitted_at.startsWith(curMonth)).sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 4);
  }
  const container = document.getElementById('tab-content');
  container.innerHTML = '';
  if (list.length === 0) { container.innerHTML = '<p class="col-span-full text-center text-sm py-8" style="color:var(--muted)">Belum ada data bulan ini</p>'; return; }
  list.forEach(w => {
    const rank = getRank(w.quiz_score || 0);
    const el = document.createElement('div');
    el.className = 'surface-card rounded-xl p-4 card-hover cursor-pointer';
    el.innerHTML = `<div class="flex items-center gap-2 mb-2">${rank ? `<span class="${rank.cls} ${rank.textCls} text-xs px-2 py-0.5 rounded-full font-bold">${rank.label}</span>` : ''}<span class="text-xs" style="color:var(--muted)">${w.work_category}</span></div><h4 class="font-semibold text-sm truncate">${w.work_title}</h4><p class="text-xs mt-1" style="color:var(--muted)">${w.name} • ${'⭐'.repeat(w.stars || 0)}</p>`;
    el.onclick = () => openWork(w);
    container.appendChild(el);
  });
}

function openWork(w) { if (w.work_link) window.open(w.work_link, '_blank', 'noopener,noreferrer'); }

// Profile
function showProfile(name) {
  const userWorks = allData.filter(d => d.name === name && d.work_type === 'work');
  const reg = allData.find(d => d.name === name && d.work_type === 'registration');
  const bestScore = Math.max(0, ...userWorks.map(w => w.quiz_score || 0));
  const rank = getRank(bestScore);
  const el = document.getElementById('profile-content');
  el.innerHTML = `
    <div class="text-center mb-6">
      <div class="rounded-full mx-auto mb-3 flex items-center justify-center text-3xl" style="background:var(--accent-light);width:80px;height:80px">👤</div>
      <h3 class="text-xl font-bold heading-display">${name}</h3>
      <p class="text-sm" style="color:var(--muted)">${reg ? reg.status + ' • ' + reg.department : 'Siswa'}</p>
      ${rank ? `<span class="${rank.cls} ${rank.textCls} text-xs px-3 py-1 rounded-full font-bold inline-block mt-2">${rank.label}</span>` : ''}
      <p class="text-xs mt-2" style="color:var(--muted)">Total Karya: ${userWorks.length} • Best Score: ${bestScore}/10</p>
    </div>
    <h4 class="font-bold text-sm mb-3">Karya</h4>
    <div class="space-y-3">${userWorks.length === 0 ? '<p class="text-sm" style="color:var(--muted)">Belum ada karya</p>' : userWorks.map(w => `
      <div class="p-3 rounded-xl cursor-pointer" style="background:var(--bg)" data-link="${w.work_link || ''}">
        <p class="font-semibold text-sm">${w.work_title}</p>
        <p class="text-xs" style="color:var(--muted)">${w.work_category} • ${'⭐'.repeat(w.stars || 0)}</p>
      </div>`).join('')}</div>`;
  el.querySelectorAll('[data-link]').forEach(node => {
    node.addEventListener('click', () => openWork({ work_link: node.getAttribute('data-link') }));
  });
  showModal('profile');
}

// Gallery
function renderGallery() {
  const works = allData.filter(d => d.work_type === 'work');
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('empty-gallery');
  if (works.length === 0) { empty.classList.remove('hidden'); empty.textContent = i18n[lang].empty; removeCards(); return; }
  empty.classList.add('hidden');
  const filtered = filterWorks(works);
  removeCards();
  const tpl = document.getElementById('card-template');
  filtered.forEach(w => {
    const clone = tpl.content.cloneNode(true);
    const card = clone.querySelector('article');
    card.querySelector('.card-title').textContent = w.work_title;
    const authorEl = card.querySelector('.card-author');
    authorEl.textContent = w.name + ' • ' + w.status;
    authorEl.onclick = (e) => { e.stopPropagation(); showProfile(w.name); };
    card.querySelector('.card-desc').textContent = (w.work_description || '').substring(0, 80);
    card.querySelector('.card-stars').textContent = '⭐'.repeat(w.stars || 0);
    card.querySelector('.card-category').textContent = w.work_category;
    const rank = getRank(w.quiz_score || 0);
    if (rank) {
      const badge = card.querySelector('.card-badge-btn');
      badge.classList.remove('hidden');
      badge.classList.add(rank.cls, rank.textCls);
      badge.textContent = rank.label;
    }
    const media = card.querySelector('.card-media');
    const link = w.work_link || '';
    if (link.includes('youtu')) {
      const vid = extractYT(link);
      media.innerHTML = vid ? `<img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" class="w-full h-full object-cover" loading="lazy">` : '<i data-lucide="play-circle" style="width:48px;height:48px;color:#fff"></i>';
    } else {
      const icon = getCategoryIcon(w.work_category);
      media.innerHTML = `<div class="text-center text-white"><img src="${icon}"class="category-icon mx-auto mb-2"alt="${w.work_category}"onerror="this.src='assets/icons/folder.png'"><p class="text-xs opacity-70">${w.work_category}</p></div>`;
    }
    card.style.cursor = 'pointer';
    card.onclick = () => openWork(w);
    grid.appendChild(clone);
  });
  if (window.lucide) lucide.createIcons();
}

function removeCards() { document.querySelectorAll('#gallery-grid article').forEach(el => el.remove()); }

function filterWorks(works) {
  const s = document.getElementById('search-input').value.toLowerCase();
  const st = document.getElementById('filter-status').value;
  const cat = document.getElementById('filter-category').value;
  const yr = document.getElementById('filter-year').value;
  return works.filter(w => {
    if (s && !w.work_title.toLowerCase().includes(s) && !w.name.toLowerCase().includes(s)) return false;
    if (st && w.status !== st) return false;
    if (cat && w.work_category !== cat) return false;
    if (yr && w.work_year !== yr) return false;
    return true;
  });
}
function filterGallery() { renderGallery(); }
function extractYT(url) { const m = url.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/); return m ? m[1] : null; }
//function getCategoryIcon(cat) { return { Video: '🎬', PDF: '📄', PPTX: '📊', Word: '📝', Image: '🖼️', MP3: '🎵', App: '💻', Website: '💻', Game: '💻', Other: '📁' }[cat] || '📁'; }
function getCategoryIcon(cat){
    const BASE="https://hendratmoko.github.io/SandenArtGallery/icons/";
    return {
        Video: BASE+"Video.png",
        PDF: BASE+"PDF.png",
        PPTX: BASE+"PPTX.png",
        Word: BASE+"Word.png",
        Excel: BASE+"Excel.png",
        Text: BASE+"Text.png",
        Image: BASE+"Image.png",
        MP3: BASE+"MP3.png",
        App: BASE+"App.png",
        Website: BASE+"Website.png",
        Game: BASE+"Game.png",
        Android: BASE+"Android.png",
        Canva: BASE+"Canva.png",
        Scratch: BASE+"Scratch.png",
        Unity: BASE+"Unity.png",
        Python: BASE+"Phyton.png",
        HTML: BASE+"Html.png",
        CSS: BASE+"CSS.png",
        JavaScript: BASE+"Javascript.png",
        Laravel: BASE+"Laravel.png",
        GitHub: BASE+"Github.png",
        Other: BASE+"Folder.png"
    }[cat] || BASE+"Folder";
}
// Register
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const code = generateCode(name);
  const record = {
    name, status: document.getElementById('reg-status').value, department: document.getElementById('reg-dept').value.trim(),
    contact: document.getElementById('reg-contact').value.trim(), access_code: code,
    publish_consent: document.getElementById('reg-consent').checked, registered_at: new Date().toISOString(),
    work_title: '', work_description: '', work_category: '', work_class: '', work_year: '', work_link: '',
    work_type: 'registration', stars: 0, certified: false, quiz_score: 0, submitted_at: '', gambar: '', guru: ''
  };
  const res = await window.dataSdk.create(record);
  if (res.isOk) {
    document.getElementById('reg-result').classList.remove('hidden');
    document.getElementById('reg-code').textContent = code;
    document.getElementById('register-form').classList.add('hidden');
  }
}

function handleUploadLogin(e) {
  e.preventDefault();
  const code = document.getElementById('upload-code').value.trim().toUpperCase();
  const user = allData.find(d => d.access_code === code && d.work_type === 'registration');
  if (!user) { document.getElementById('code-error').classList.remove('hidden'); return; }
  document.getElementById('code-error').classList.add('hidden');
  currentUser = user;
  document.getElementById('upload-login').classList.add('hidden');
  document.getElementById('upload-form-wrap').classList.remove('hidden');
  document.getElementById('upload-user-name').textContent = '👋 ' + user.name + ' (' + user.status + ')';
}

async function handleUpload(e) {
  e.preventDefault();
  const wantQuiz = document.getElementById('up-quiz').checked;
  const work = {
    name: currentUser.name, status: currentUser.status, department: currentUser.department, contact: currentUser.contact,
    access_code: currentUser.access_code, publish_consent: currentUser.publish_consent, registered_at: currentUser.registered_at,
    work_title: document.getElementById('up-title').value.trim(), work_description: document.getElementById('up-desc').value.trim(),
    work_category: document.getElementById('up-category').value, work_class: document.getElementById('up-class').value.trim(),
    work_year: document.getElementById('up-year').value.trim(), work_link: document.getElementById('up-link').value.trim(),
    work_type: 'work', stars: 0, certified: false, quiz_score: 0, submitted_at: new Date().toISOString()
  };
  if (wantQuiz) { pendingWork = work; startQuiz(work.work_category); } else { await submitWork(work); }
}

async function submitWork(work) {
  const res = await window.dataSdk.create(work);
  if (res.isOk) { hideModal('upload'); resetUploadForm(); }
}
function resetUploadForm() {
  document.getElementById('upload-form').reset();
  document.getElementById('upload-login').classList.remove('hidden');
  document.getElementById('upload-form-wrap').classList.add('hidden');
  currentUser = null;
}

// Quiz
function startQuiz(category) {
  hideModal('upload'); quizIndex = 0; quizCorrect = 0; quizData = generateQuizQuestions();
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-counter').classList.remove('hidden');
  document.getElementById('quiz-question').classList.remove('hidden');
  document.getElementById('quiz-options').classList.remove('hidden');
  showModal('quiz'); renderQuizQuestion();
}

function generateQuizQuestions() {
  return [
    { q: 'Apa prinsip utama desain visual yang baik?', o: ['Keseimbangan & kontras', 'Warna acak', 'Tanpa margin', 'Font besar'], a: 0 },
    { q: 'Format file apa yang mendukung transparansi?', o: ['PNG', 'JPG', 'BMP', 'TIFF'], a: 0 },
    { q: 'Apa kepanjangan dari PDF?', o: ['Portable Document Format', 'Print Data File', 'Page Design Format', 'Public Doc File'], a: 0 },
    { q: 'Resolusi standar video HD adalah?', o: ['1920x1080', '800x600', '1280x720', '640x480'], a: 0 },
    { q: 'Software editing video profesional adalah?', o: ['Adobe Premiere Pro', 'Microsoft Word', 'Google Sheets', 'Notepad'], a: 0 },
    { q: 'Apa fungsi metadata dalam file digital?', o: ['Menyimpan informasi tentang file', 'Menghapus file', 'Mengenkripsi konten', 'Memperbesar ukuran'], a: 0 },
    { q: 'Codec audio yang paling umum digunakan?', o: ['MP3/AAC', 'BMP', 'TIFF', 'RAW'], a: 0 },
    { q: 'Prinsip KISS dalam desain berarti?', o: ['Keep It Simple, Stupid', 'Keep It Super Smart', 'Keep In Same Style', 'Kill Irrelevant Stupid Stuff'], a: 0 },
    { q: 'Apa itu responsive design?', o: ['Desain yang menyesuaikan layar', 'Desain yang cepat', 'Desain yang mahal', 'Desain 3D'], a: 0 },
    { q: 'Version control berguna untuk?', o: ['Melacak perubahan kode/file', 'Mempercepat internet', 'Menghapus virus', 'Membuat backup otomatis'], a: 0 }
  ].sort(() => Math.random() - 0.5);
}

function renderQuizQuestion() {
  if (quizIndex >= 10) { finishQuiz(); return; }
  const q = quizData[quizIndex];
  document.getElementById('quiz-bar').style.width = ((quizIndex + 1) * 10) + '%';
  document.getElementById('quiz-counter').textContent = `Soal ${quizIndex + 1}/10`;
  document.getElementById('quiz-question').textContent = q.q;
  const opts = document.getElementById('quiz-options');
  opts.innerHTML = '';
  q.o.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full text-left px-5 py-3.5 rounded-xl text-sm font-medium input-field';
    btn.style.display = 'block';
    btn.textContent = opt;
    btn.onclick = () => answerQuiz(i);
    opts.appendChild(btn);
  });
}

function answerQuiz(idx) { if (idx === quizData[quizIndex].a) quizCorrect++; quizIndex++; renderQuizQuestion(); }

async function finishQuiz() {
  document.getElementById('quiz-counter').classList.add('hidden');
  document.getElementById('quiz-question').classList.add('hidden');
  document.getElementById('quiz-options').classList.add('hidden');
  document.getElementById('quiz-result').classList.remove('hidden');
  document.getElementById('quiz-stars').textContent = '⭐'.repeat(quizCorrect);
  document.getElementById('quiz-score-text').textContent = `Skor: ${quizCorrect}/10`;
  document.getElementById('quiz-cert-msg').textContent = quizCorrect > 0 ? 'Selamat! Anda mendapatkan Sertifikat Skill Passport' : 'Coba lagi lain waktu';
  if (pendingWork) {
    pendingWork.stars = quizCorrect; pendingWork.certified = quizCorrect > 0; pendingWork.quiz_score = quizCorrect;
    await submitWork(pendingWork);
    pendingWork = null;
  }
}

const slides=document.querySelectorAll(".slide");
let current=0;
setInterval(()=>{
    slides[current].classList.remove("active");
    current++;
    if(current>=slides.length){
        current=0;
    }
    slides[current].classList.add("active");
},8000);

/*=========================
BACK TO TOP
=========================
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll",()=>{
    if(window.scrollY>350){
        backToTop.classList.add("show");
    }else{
        backToTop.classList.remove("show");
    }
});
backToTop.addEventListener("click",()=>{
    window.scrollTo({
        top:0,
        behavior:"smooth"
    });
});
*/
