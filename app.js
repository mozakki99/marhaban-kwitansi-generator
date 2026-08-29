/**
 * Kwitansi Generator - Amanah Safar Marhaban
 * JavaScript ES6 Logic: Multi-Theme Switcher, Cloudflare D1 Database Cloud Sync (/api/kwitansi),
 * Rekening Resmi Pembayaran Sah Banner, LocalStorage Fallback & Offline Resilience
 */

let currentKwitansiId = null;
let dynamicFasilitasCount = 0;
let currentTheme = 'purple';

// State Images (Base64 Data URLs)
let customLogoDataUrl = null;
let customTtdKasirDataUrl = null;
let customStempelDataUrl = null;

// Canvas Drawer Pad Variables
let canvas, ctx;
let isDrawing = false;

// Helper: Konversi Angka ke Kalimat Terbilang Bahasa Indonesia
function terbilangRupiah(nilai) {
  let nominal = Math.abs(parseInt(nilai, 10)) || 0;
  if (nominal === 0) return "Nol Rupiah";

  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

  function konversi(n) {
    if (n < 12) return " " + satuan[n];
    else if (n < 20) return konversi(n - 10) + " Belas";
    else if (n < 100) return konversi(Math.floor(n / 10)) + " Puluh" + konversi(n % 10);
    else if (n < 200) return " Seratus" + konversi(n - 100);
    else if (n < 1000) return konversi(Math.floor(n / 100)) + " Ratus" + konversi(n % 100);
    else if (n < 2000) return " Seribu" + konversi(n - 1000);
    else if (n < 1000000) return konversi(Math.floor(n / 1000)) + " Ribu" + konversi(n % 1000);
    else if (n < 1000000000) return konversi(Math.floor(n / 1000000)) + " Juta" + konversi(n % 1000000);
    else if (n < 1000000000000) return konversi(Math.floor(n / 1000000000)) + " Miliar" + konversi(n % 1000000000);
    return "";
  }

  let hasil = konversi(nominal).trim();
  return `"${hasil} Rupiah"`;
}

function formatRupiah(angka) {
  const number = parseInt(angka, 10) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(number);
}

function formatTanggalIndo(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function generateNoKwitansi() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const count = (getHistory().length + 1).toString().padStart(3, '0');
  return `KW/MRH/${year}/${month}/${count}`;
}

// DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('input-tanggal').value = today;
  document.getElementById('input-no-kwitansi').value = generateNoKwitansi();

  // Restore Last Saved Theme from LocalStorage
  const savedTheme = localStorage.getItem('marhaban_saved_theme') || 'purple';
  setTheme(savedTheme);

  // Initialize Canvas
  initCanvasPad();

  // Load Cloud DB History on start
  syncCloudHistory();

  // Settings Modal Handlers
  document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);
  document.getElementById('btn-close-settings-save').addEventListener('click', closeSettingsModal);
  document.getElementById('modal-settings').addEventListener('click', (e) => {
    if (e.target.id === 'modal-settings') closeSettingsModal();
  });

  // Theme Cards Switcher
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const val = card.getAttribute('data-theme-val');
      setTheme(val);
    });
  });

  // Sync Form Realtime
  const form = document.getElementById('kwitansi-form');
  form.addEventListener('input', (e) => {
    if (e.target.id === 'input-pax-dewasa' || e.target.id === 'input-harga-dewasa' ||
        e.target.id === 'input-pax-bayi' || e.target.id === 'input-harga-bayi' ||
        e.target.id === 'input-biaya-tambahan') {
      calculateTotalBiayaPaket();
    }
    updatePreview();
  });
  form.addEventListener('change', updatePreview);

  // Settings Modal inputs listener for live updates
  const settingsModal = document.getElementById('modal-settings');
  settingsModal.addEventListener('input', updatePreview);
  settingsModal.addEventListener('change', updatePreview);

  // Checkbox Listener
  const checkboxes = document.querySelectorAll('input[name="fasilitas"]');
  checkboxes.forEach(cb => cb.addEventListener('change', updatePreview));

  // Dynamic Facilities
  document.getElementById('btn-add-fasilitas').addEventListener('click', addDynamicFasilitasInput);

  // Header Logo Upload
  document.getElementById('input-logo-file').addEventListener('change', handleLogoUpload);

  // TTD Upload & Draw
  document.getElementById('btn-draw-ttd').addEventListener('click', openCanvasModal);
  document.getElementById('btn-close-ttd-modal').addEventListener('click', closeCanvasModal);
  document.getElementById('btn-clear-canvas').addEventListener('click', clearCanvas);
  document.getElementById('btn-save-canvas').addEventListener('click', saveCanvasSignature);
  document.getElementById('input-ttd-file').addEventListener('change', handleTtdUpload);
  document.getElementById('btn-clear-ttd').addEventListener('click', clearTtdSignature);

  // Stempel Upload
  document.getElementById('input-stempel-file').addEventListener('change', handleStempelUpload);
  document.getElementById('btn-clear-stempel').addEventListener('click', clearStempelImage);

  // Buttons
  document.getElementById('btn-new').addEventListener('click', resetForm);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-save').addEventListener('click', simpanKwitansi);
  document.getElementById('btn-history').addEventListener('click', openHistoryModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeHistoryModal);
  document.getElementById('modal-history').addEventListener('click', (e) => {
    if (e.target.id === 'modal-history') closeHistoryModal();
  });
  document.getElementById('search-history').addEventListener('input', filterHistoryTable);

  calculateTotalBiayaPaket();
  updatePreview();
});

// Theme Switcher & Persistence Logic
function setTheme(themeName) {
  currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  try {
    localStorage.setItem('marhaban_saved_theme', themeName);
  } catch (e) {}

  // Update Active Theme Card State in Modal
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(c => {
    if (c.getAttribute('data-theme-val') === themeName) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

function openSettingsModal() {
  document.getElementById('modal-settings').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('modal-settings').classList.remove('active');
  updatePreview();
}

// Canvas Signature Pad Logic
function initCanvasPad() {
  canvas = document.getElementById('canvas-ttd');
  ctx = canvas.getContext('2d');
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#532380';

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); });
}

function openCanvasModal() {
  document.getElementById('modal-draw-ttd').classList.add('active');
  clearCanvas();
}

function closeCanvasModal() {
  document.getElementById('modal-draw-ttd').classList.remove('active');
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveCanvasSignature() {
  customTtdKasirDataUrl = canvas.toDataURL('image/png');
  document.getElementById('img-ttd-preview').src = customTtdKasirDataUrl;
  document.getElementById('ttd-preview-thumb').style.display = 'flex';
  closeCanvasModal();
  updatePreview();
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      customLogoDataUrl = event.target.result;
      document.getElementById('view-logo-img').src = customLogoDataUrl;
      document.getElementById('app-header-logo').src = customLogoDataUrl;
    };
    reader.readAsDataURL(file);
  }
}

function handleTtdUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      customTtdKasirDataUrl = event.target.result;
      document.getElementById('img-ttd-preview').src = customTtdKasirDataUrl;
      document.getElementById('ttd-preview-thumb').style.display = 'flex';
      updatePreview();
    };
    reader.readAsDataURL(file);
  }
}

function clearTtdSignature() {
  customTtdKasirDataUrl = null;
  document.getElementById('ttd-preview-thumb').style.display = 'none';
  document.getElementById('input-ttd-file').value = '';
  updatePreview();
}

function handleStempelUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      customStempelDataUrl = event.target.result;
      document.getElementById('img-stempel-preview').src = customStempelDataUrl;
      document.getElementById('stempel-preview-thumb').style.display = 'flex';
      updatePreview();
    };
    reader.readAsDataURL(file);
  }
}

function clearStempelImage() {
  customStempelDataUrl = null;
  document.getElementById('stempel-preview-thumb').style.display = 'none';
  document.getElementById('input-stempel-file').value = '';
  updatePreview();
}

// Calculate Total Biaya Paket Otomatis
function calculateTotalBiayaPaket() {
  const paxDewasa = parseInt(document.getElementById('input-pax-dewasa').value, 10) || 0;
  const hargaDewasa = parseInt(document.getElementById('input-harga-dewasa').value, 10) || 0;
  const paxBayi = parseInt(document.getElementById('input-pax-bayi').value, 10) || 0;
  const hargaBayi = parseInt(document.getElementById('input-harga-bayi').value, 10) || 0;
  const biayaTambahan = parseInt(document.getElementById('input-biaya-tambahan').value, 10) || 0;

  const total = (paxDewasa * hargaDewasa) + (paxBayi * hargaBayi) + biayaTambahan;
  document.getElementById('input-total').value = total;
}

// Dynamic Custom Facility Builder
function addDynamicFasilitasInput(valueText = '') {
  dynamicFasilitasCount++;
  const container = document.getElementById('dynamic-fasilitas-container');
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '0.4rem';
  div.style.alignItems = 'center';
  div.id = `dynamic-fas-${dynamicFasilitasCount}`;

  div.innerHTML = `
    <input type="text" class="input-custom-fasilitas" placeholder="Fasilitas Kustom (misal: City Tour Taif...)" value="${valueText}" style="font-size:0.8rem; padding:0.4rem 0.6rem;">
    <button type="button" class="btn btn-secondary" style="padding:0.4rem 0.6rem; background:#ef4444; border:none; font-size:0.75rem;" onclick="removeDynamicFasilitas('dynamic-fas-${dynamicFasilitasCount}')">🗑️</button>
  `;

  container.appendChild(div);

  const inputEl = div.querySelector('.input-custom-fasilitas');
  inputEl.addEventListener('input', updatePreview);
  inputEl.focus();
  updatePreview();
}

function removeDynamicFasilitas(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.remove();
  updatePreview();
}

// Update Real-Time Preview
function updatePreview() {
  const noKwitansi = document.getElementById('input-no-kwitansi').value || '-';
  const tanggal = document.getElementById('input-tanggal').value;
  const namaJamaah = document.getElementById('input-nama').value || '...................................................';
  const noWa = document.getElementById('input-wa').value || '-';
  const pilihanPaket = document.getElementById('input-paket').value || 'Paket Umrah Marhaban';
  const programHari = document.getElementById('input-program').value || '9 Hari';
  const tipeKamar = document.getElementById('input-kamar').value || 'Quad (Ber-4)';

  // Editable Header Details
  const headerBrand = document.getElementById('input-header-brand').value.trim() || 'Amanah Safar Marhaban';
  const headerSub = document.getElementById('input-header-sub').value.trim();
  const headerPpiu = document.getElementById('input-header-ppiu').value.trim();
  const headerPihk = document.getElementById('input-header-pihk').value.trim();
  const headerAlamat = document.getElementById('input-header-alamat').value.trim() || '-';
  const headerKontak = document.getElementById('input-header-kontak').value.trim() || '-';
  const headerIg = document.getElementById('input-header-ig').value.trim() || '@marhabantour';
  const headerTg = document.getElementById('input-header-tg').value.trim() || '@marhabantour';
  const headerRekening = document.getElementById('input-header-rekening').value.trim();

  // Render Header Kwitansi Brand
  document.getElementById('view-header-brand').textContent = headerBrand;

  // STRICT HIDING: Nama PT Subhead
  const viewHeaderSub = document.getElementById('view-header-sub');
  if (headerSub.length > 0) {
    viewHeaderSub.textContent = headerSub;
    viewHeaderSub.style.display = 'block';
  } else {
    viewHeaderSub.textContent = '';
    viewHeaderSub.style.display = 'none';
  }

  // Address
  document.getElementById('view-alamat-text').textContent = headerAlamat;

  // Social Media Bar Icons
  const viewSocialWa = document.getElementById('view-social-wa');
  const viewSocialIg = document.getElementById('view-social-ig');
  const viewSocialTg = document.getElementById('view-social-tg');

  if (headerKontak.length > 0) {
    document.getElementById('view-text-wa').textContent = headerKontak;
    viewSocialWa.style.display = 'inline-flex';
  } else {
    viewSocialWa.style.display = 'none';
  }

  if (headerIg.length > 0) {
    document.getElementById('view-text-ig').textContent = headerIg;
    viewSocialIg.style.display = 'inline-flex';
  } else {
    viewSocialIg.style.display = 'none';
  }

  if (headerTg.length > 0) {
    document.getElementById('view-text-tg').textContent = headerTg;
    viewSocialTg.style.display = 'inline-flex';
  } else {
    viewSocialTg.style.display = 'none';
  }

  // STRICT HIDING: PPIU & PIHK Badges
  const ppiuBadge = document.getElementById('view-header-ppiu');
  const pihkBadge = document.getElementById('view-header-pihk');
  const badgesContainer = document.getElementById('view-company-badges');

  if (headerPpiu.length > 0) {
    ppiuBadge.textContent = `PPIU: ${headerPpiu}`;
    ppiuBadge.style.display = 'inline-block';
  } else {
    ppiuBadge.textContent = '';
    ppiuBadge.style.display = 'none';
  }

  if (headerPihk.length > 0) {
    pihkBadge.textContent = `PIHK: ${headerPihk}`;
    pihkBadge.style.display = 'inline-block';
  } else {
    pihkBadge.textContent = '';
    pihkBadge.style.display = 'none';
  }

  if (headerPpiu.length === 0 && headerPihk.length === 0) {
    badgesContainer.style.display = 'none';
  } else {
    badgesContainer.style.display = 'flex';
  }

  // Rekening Resmi Pembayaran Banner
  const bankBanner = document.getElementById('view-bank-banner');
  const bankDetails = document.getElementById('view-bank-details');
  if (headerRekening.length > 0) {
    bankDetails.textContent = headerRekening;
    bankBanner.style.display = 'flex';
  } else {
    bankBanner.style.display = 'none';
  }

  // App Header Sync
  let subHeaderText = headerSub || headerBrand;
  if (headerPpiu) subHeaderText += ` | PPIU: ${headerPpiu}`;
  if (headerPihk) subHeaderText += ` | PIHK: ${headerPihk}`;
  document.getElementById('app-header-title').textContent = headerBrand;
  document.getElementById('app-header-sub').textContent = subHeaderText;

  // Note Footer Sync
  document.getElementById('view-note-brand').textContent = headerSub ? `${headerBrand} (${headerSub})` : headerBrand;

  // Pax Breakdown
  const paxDewasa = parseInt(document.getElementById('input-pax-dewasa').value, 10) || 0;
  const hargaDewasa = parseInt(document.getElementById('input-harga-dewasa').value, 10) || 0;
  const paxBayi = parseInt(document.getElementById('input-pax-bayi').value, 10) || 0;
  const hargaBayi = parseInt(document.getElementById('input-harga-bayi').value, 10) || 0;
  const biayaTambahan = parseInt(document.getElementById('input-biaya-tambahan').value, 10) || 0;

  // Keuangan
  const totalHarga = parseInt(document.getElementById('input-total').value, 10) || 0;
  const nominalBayar = parseInt(document.getElementById('input-bayar').value, 10) || 0;
  const jenisBayar = document.getElementById('input-jenis-bayar').value;
  const metodeBayar = document.getElementById('input-metode').value;
  const catatan = document.getElementById('input-catatan').value || '-';

  const kekurangan = Math.max(0, totalHarga - nominalBayar);
  const statusPembayaran = (kekurangan === 0 && totalHarga > 0) ? 'LUNAS' : (nominalBayar > 0 ? 'DP / BERTAHAP' : 'BELUM LUNAS');

  // Kumpulkan Fasilitas
  const selectedFasilitas = [];
  document.querySelectorAll('input[name="fasilitas"]:checked').forEach(cb => {
    selectedFasilitas.push(cb.value);
  });

  document.querySelectorAll('.input-custom-fasilitas').forEach(inp => {
    const val = inp.value.trim();
    if (val) selectedFasilitas.push(val);
  });

  // Render Body Details
  document.getElementById('view-no-kwitansi').textContent = noKwitansi;
  document.getElementById('view-tanggal').textContent = formatTanggalIndo(tanggal);
  document.getElementById('view-nama-jamaah').textContent = namaJamaah;
  document.getElementById('view-no-wa').textContent = noWa;
  document.getElementById('view-pilihan-paket').textContent = `${pilihanPaket} (${programHari}) - ${tipeKamar}`;
  
  let paxText = `${paxDewasa} Pax Dewasa`;
  if (paxBayi > 0) paxText += ` + ${paxBayi} Bayi/Infant`;
  document.getElementById('view-jumlah-jamaah-pax').textContent = paxText;

  document.getElementById('view-jenis-bayar').textContent = jenisBayar;
  document.getElementById('view-metode').textContent = metodeBayar;
  document.getElementById('view-catatan').textContent = catatan;
  document.getElementById('view-terbilang').textContent = terbilangRupiah(nominalBayar);

  // Render Financial Table Breakdown
  const tableBody = document.getElementById('view-table-breakdown-body');
  let tableHtml = '';

  const subtotalDewasa = paxDewasa * hargaDewasa;
  tableHtml += `
    <tr>
      <td>Paket Dewasa (${paxDewasa} Pax @ ${formatRupiah(hargaDewasa)})</td>
      <td style="text-align: right;">${formatRupiah(subtotalDewasa)}</td>
    </tr>
  `;

  if (paxBayi > 0) {
    const subtotalBayi = paxBayi * hargaBayi;
    tableHtml += `
      <tr>
        <td>Paket Bayi / Infant (${paxBayi} Bayi @ ${formatRupiah(hargaBayi)})</td>
        <td style="text-align: right;">${formatRupiah(subtotalBayi)}</td>
      </tr>
    `;
  }

  if (biayaTambahan > 0) {
    tableHtml += `
      <tr>
        <td>Biaya Tambahan / Add-on Layanan</td>
        <td style="text-align: right;">${formatRupiah(biayaTambahan)}</td>
      </tr>
    `;
  }

  tableHtml += `
    <tr style="background-color: var(--theme-soft); font-weight: 700;">
      <td><strong>TOTAL BIAYA PAKET</strong></td>
      <td style="text-align: right; font-weight: 800;">${formatRupiah(totalHarga)}</td>
    </tr>
    <tr>
      <td><strong>Jumlah Dibayar Saat Ini (Kwitansi Ini)</strong></td>
      <td style="text-align: right; color: #15803d; font-weight: 800;">${formatRupiah(nominalBayar)}</td>
    </tr>
    <tr class="total-row">
      <td><strong>SISA TAGIHAN / KEKURANGAN</strong></td>
      <td style="text-align: right; font-size: 0.95rem;">${formatRupiah(kekurangan)}</td>
    </tr>
  `;

  tableBody.innerHTML = tableHtml;
  document.getElementById('view-nominal-big').textContent = formatRupiah(nominalBayar);

  // Render Chips Fasilitas
  const chipsContainer = document.getElementById('view-fasilitas-chips');
  chipsContainer.innerHTML = '';
  if (selectedFasilitas.length > 0) {
    selectedFasilitas.forEach(fas => {
      const chip = document.createElement('span');
      chip.className = 'fasilitas-chip';
      chip.textContent = fas;
      chipsContainer.appendChild(chip);
    });
  } else {
    chipsContainer.innerHTML = '<span style="color:#94a3b8; font-style:italic; font-size:0.75rem;">Fasilitas Sesuai Kesepakatan Paket</span>';
  }

  // Render Single Signature (Umar Al-Hasyimi / Admin Marhaban Tour)
  const ttdNamaKasir = document.getElementById('input-ttd-nama').value.trim() || 'Umar Al-Hasyimi';
  document.getElementById('view-ttd-kasir-nama').textContent = `( ${ttdNamaKasir} )`;

  const kasirTtdContainer = document.getElementById('view-ttd-kasir-container');
  if (customTtdKasirDataUrl) {
    kasirTtdContainer.innerHTML = `<img src="${customTtdKasirDataUrl}" style="height: 55px; width: auto; object-fit: contain;">`;
  } else {
    kasirTtdContainer.innerHTML = '';
  }

  const stempelImg = document.getElementById('view-stempel-img');
  if (customStempelDataUrl) {
    stempelImg.src = customStempelDataUrl;
    stempelImg.style.display = 'block';
  } else {
    stempelImg.style.display = 'none';
  }

  // Watermark Status
  const stampEl = document.getElementById('view-watermark-stamp');
  const badgeEl = document.getElementById('view-status-badge');

  if (statusPembayaran === 'LUNAS') {
    stampEl.textContent = 'LUNAS';
    stampEl.className = 'watermark-stamp stamp-lunas';
    badgeEl.textContent = 'LUNAS';
    badgeEl.className = 'badge-status-preview badge-lunas';
  } else {
    stampEl.textContent = statusPembayaran === 'DP / BERTAHAP' ? 'DP / BERTAHAP' : 'BELUM LUNAS';
    stampEl.className = 'watermark-stamp stamp-dp';
    badgeEl.textContent = statusPembayaran;
    badgeEl.className = 'badge-status-preview badge-dp';
  }
}

// Reset Form
function resetForm() {
  currentKwitansiId = null;
  document.getElementById('kwitansi-form').reset();
  document.getElementById('dynamic-fasilitas-container').innerHTML = '';
  document.getElementById('input-pax-dewasa').value = '1';
  document.getElementById('input-harga-dewasa').value = '35000000';
  document.getElementById('input-pax-bayi').value = '0';
  document.getElementById('input-harga-bayi').value = '5000000';
  document.getElementById('input-biaya-tambahan').value = '0';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('input-tanggal').value = today;
  document.getElementById('input-no-kwitansi').value = generateNoKwitansi();
  
  calculateTotalBiayaPaket();
  updatePreview();
}

// Local Storage History
function getHistory() {
  try {
    const data = localStorage.getItem('marhaban_kwitansi_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(historyList) {
  try {
    localStorage.setItem('marhaban_kwitansi_history', JSON.stringify(historyList));
  } catch (e) {
    alert("Gagal menyimpan ke riwayat.");
  }
}

// Cloud D1 SQL Sync Logic
async function syncCloudHistory() {
  try {
    const res = await fetch('/api/kwitansi');
    if (res.ok) {
      const cloudHistory = await res.json();
      if (Array.isArray(cloudHistory) && cloudHistory.length > 0) {
        saveHistory(cloudHistory);
      }
    }
  } catch (e) {
    console.log("Cloud D1 sync fallback to local storage:", e);
  }
}

async function simpanKwitansi() {
  const namaJamaah = document.getElementById('input-nama').value.trim();
  if (!namaJamaah) {
    alert("Mohon isi Nama Jamaah terlebih dahulu.");
    return;
  }

  const customFas = [];
  document.querySelectorAll('.input-custom-fasilitas').forEach(inp => {
    if (inp.value.trim()) customFas.push(inp.value.trim());
  });

  const selectedCheckboxes = [];
  document.querySelectorAll('input[name="fasilitas"]:checked').forEach(cb => {
    selectedCheckboxes.push(cb.value);
  });

  const paxDewasa = parseInt(document.getElementById('input-pax-dewasa').value, 10) || 0;
  const hargaDewasa = parseInt(document.getElementById('input-harga-dewasa').value, 10) || 0;
  const paxBayi = parseInt(document.getElementById('input-pax-bayi').value, 10) || 0;
  const hargaBayi = parseInt(document.getElementById('input-harga-bayi').value, 10) || 0;
  const biayaTambahan = parseInt(document.getElementById('input-biaya-tambahan').value, 10) || 0;

  const totalHarga = parseInt(document.getElementById('input-total').value, 10) || 0;
  const nominalBayar = parseInt(document.getElementById('input-bayar').value, 10) || 0;
  const kekurangan = Math.max(0, totalHarga - nominalBayar);
  const statusPembayaran = (kekurangan === 0 && totalHarga > 0) ? 'LUNAS' : 'DP / BERTAHAP';

  const kwitansiData = {
    id: currentKwitansiId || 'KW-' + Date.now(),
    noKwitansi: document.getElementById('input-no-kwitansi').value,
    tanggal: document.getElementById('input-tanggal').value,
    namaJamaah: namaJamaah,
    noWa: document.getElementById('input-wa').value,
    paket: document.getElementById('input-paket').value,
    program: document.getElementById('input-program').value,
    kamar: document.getElementById('input-kamar').value,
    theme: currentTheme,
    
    headerBrand: document.getElementById('input-header-brand').value,
    headerSub: document.getElementById('input-header-sub').value,
    headerPpiu: document.getElementById('input-header-ppiu').value,
    headerPihk: document.getElementById('input-header-pihk').value,
    headerAlamat: document.getElementById('input-header-alamat').value,
    headerKontak: document.getElementById('input-header-kontak').value,
    headerIg: document.getElementById('input-header-ig').value,
    headerTg: document.getElementById('input-header-tg').value,
    headerRekening: document.getElementById('input-header-rekening').value,
    logoDataUrl: customLogoDataUrl,

    ttdKasirNama: document.getElementById('input-ttd-nama').value,
    ttdKasirDataUrl: customTtdKasirDataUrl,
    stempelDataUrl: customStempelDataUrl,

    paxDewasa: paxDewasa,
    hargaDewasa: hargaDewasa,
    paxBayi: paxBayi,
    hargaBayi: hargaBayi,
    biayaTambahan: biayaTambahan,
    checkboxes: selectedCheckboxes,
    customFas: customFas,
    totalHarga: totalHarga,
    nominalBayar: nominalBayar,
    kekurangan: kekurangan,
    jenisBayar: document.getElementById('input-jenis-bayar').value,
    metode: document.getElementById('input-metode').value,
    catatan: document.getElementById('input-catatan').value,
    status: statusPembayaran,
    timestamp: new Date().toISOString()
  };

  // 1. Save to LocalStorage immediately
  let history = getHistory();
  if (currentKwitansiId) {
    const index = history.findIndex(item => item.id === currentKwitansiId);
    if (index !== -1) history[index] = kwitansiData;
  } else {
    history.unshift(kwitansiData);
    currentKwitansiId = kwitansiData.id;
  }
  saveHistory(history);

  // 2. Sync to Cloudflare D1 SQL Database via Serverless API
  try {
    const res = await fetch('/api/kwitansi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kwitansiData)
    });
    if (res.ok) {
      console.log("☁️ Successfully synced to Cloudflare D1 Database!");
    }
  } catch (e) {
    console.log("Cloud sync fallback:", e);
  }

  alert(`✓ Kwitansi ${kwitansiData.noKwitansi} berhasil disimpan ke Database Cloudflare & Riwayat Transaksi!`);
}

function openHistoryModal() {
  syncCloudHistory().then(() => renderHistoryTable());
  document.getElementById('modal-history').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.remove('active');
}

function renderHistoryTable(filterText = '') {
  const history = getHistory();
  const tbody = document.getElementById('tbody-history');
  tbody.innerHTML = '';

  const filtered = history.filter(item => {
    const q = filterText.toLowerCase();
    return item.namaJamaah.toLowerCase().includes(q) ||
           item.noKwitansi.toLowerCase().includes(q) ||
           (item.noWa && item.noWa.includes(q)) ||
           item.paket.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#64748b;">Belum ada riwayat kwitansi tersimpan.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.noKwitansi}</strong></td>
      <td>${formatTanggalIndo(item.tanggal)}</td>
      <td><strong>${item.namaJamaah}</strong><br><small style="color:#64748b">${item.noWa || '-'}</small></td>
      <td>${item.paket}</td>
      <td>${formatRupiah(item.nominalBayar)}</td>
      <td><span class="${item.status === 'LUNAS' ? 'badge-status-preview badge-lunas' : 'badge-status-preview badge-dp'}">${item.status}</span></td>
      <td>
        <button class="btn btn-outline" style="padding:0.25rem 0.6rem; font-size:0.75rem;" onclick="loadKwitansi('${item.id}')">✏️ Buka</button>
        <button class="btn btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.75rem; background:#ef4444; border:none;" onclick="hapusKwitansi('${item.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterHistoryTable() {
  const text = document.getElementById('search-history').value;
  renderHistoryTable(text);
}

function loadKwitansi(id) {
  const history = getHistory();
  const item = history.find(i => i.id === id);
  if (!item) return;

  currentKwitansiId = item.id;
  document.getElementById('input-no-kwitansi').value = item.noKwitansi;
  document.getElementById('input-tanggal').value = item.tanggal;
  document.getElementById('input-nama').value = item.namaJamaah;
  document.getElementById('input-wa').value = item.noWa || '';
  document.getElementById('input-paket').value = item.paket || 'Paket Umrah Marhaban';
  document.getElementById('input-program').value = item.program || '9 Hari';
  document.getElementById('input-kamar').value = item.kamar || 'Quad (Ber-4)';
  
  if (item.theme) {
    setTheme(item.theme);
  }

  if (item.headerBrand) document.getElementById('input-header-brand').value = item.headerBrand;
  document.getElementById('input-header-sub').value = item.headerSub !== undefined ? item.headerSub : 'PT AMANAH TANGGUH MANDIRI';
  document.getElementById('input-header-ppiu').value = item.headerPpiu !== undefined ? item.headerPpiu : '23022300424760012';
  document.getElementById('input-header-pihk').value = item.headerPihk !== undefined ? item.headerPihk : '23022300424760013';
  if (item.headerAlamat) document.getElementById('input-header-alamat').value = item.headerAlamat;
  if (item.headerKontak) document.getElementById('input-header-kontak').value = item.headerKontak;
  if (item.headerIg !== undefined) document.getElementById('input-header-ig').value = item.headerIg;
  if (item.headerTg !== undefined) document.getElementById('input-header-tg').value = item.headerTg;
  document.getElementById('input-header-rekening').value = item.headerRekening !== undefined ? item.headerRekening : 'Bank Mandiri: PT Ardhana Putra Marhaban 144-00-5000045-1';
  
  if (item.logoDataUrl) {
    customLogoDataUrl = item.logoDataUrl;
    document.getElementById('view-logo-img').src = customLogoDataUrl;
    document.getElementById('app-header-logo').src = customLogoDataUrl;
  }

  document.getElementById('input-ttd-nama').value = item.ttdKasirNama || 'Umar Al-Hasyimi';
  if (item.ttdKasirDataUrl) {
    customTtdKasirDataUrl = item.ttdKasirDataUrl;
    document.getElementById('img-ttd-preview').src = customTtdKasirDataUrl;
    document.getElementById('ttd-preview-thumb').style.display = 'flex';
  } else {
    clearTtdSignature();
  }

  if (item.stempelDataUrl) {
    customStempelDataUrl = item.stempelDataUrl;
    document.getElementById('img-stempel-preview').src = customStempelDataUrl;
    document.getElementById('stempel-preview-thumb').style.display = 'flex';
  } else {
    clearStempelImage();
  }

  document.getElementById('input-pax-dewasa').value = item.paxDewasa || 1;
  document.getElementById('input-harga-dewasa').value = item.hargaDewasa || 35000000;
  document.getElementById('input-pax-bayi').value = item.paxBayi || 0;
  document.getElementById('input-harga-bayi').value = item.hargaBayi || 5000000;
  document.getElementById('input-biaya-tambahan').value = item.biayaTambahan || 0;

  document.getElementById('input-total').value = item.totalHarga || 0;
  document.getElementById('input-bayar').value = item.nominalBayar || 0;
  document.getElementById('input-jenis-bayar').value = item.jenisBayar || 'DP / Uang Muka Pendaftaran';
  document.getElementById('input-metode').value = item.metode || 'Transfer Bank BSI';
  document.getElementById('input-catatan').value = item.catatan || '';

  // Restore Checkboxes
  if (item.checkboxes) {
    document.querySelectorAll('input[name="fasilitas"]').forEach(cb => {
      cb.checked = item.checkboxes.includes(cb.value);
    });
  }

  // Restore Custom Facilities
  document.getElementById('dynamic-fasilitas-container').innerHTML = '';
  if (item.customFas && Array.isArray(item.customFas)) {
    item.customFas.forEach(fasText => {
      addDynamicFasilitasInput(fasText);
    });
  }

  updatePreview();
  closeHistoryModal();
}

async function hapusKwitansi(id) {
  if (!confirm("Apakah Anda yakin ingin menghapus kwitansi ini dari riwayat?")) return;
  let history = getHistory();
  history = history.filter(item => item.id !== id);
  saveHistory(history);

  // Sync delete to Cloudflare D1
  try {
    await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } catch (e) {}

  renderHistoryTable(document.getElementById('search-history').value);
}
