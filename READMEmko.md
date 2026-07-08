# Galeri Karya SMKN 1 Sanden

## Struktur File
| File | Fungsi |
|---|---|
| `index.html` | Struktur halaman (HTML) |
| `style.css` | Seluruh tampilan/CSS |
| `config.js` | **Isi `GAS_URL` di sini** |
| `script.js` | Logika aplikasi (render galeri, quiz, filter, dll) |
| `data.json` | Data contoh untuk mode demo/offline |
| `Code.gs` | Backend — ditempel ke Google Apps Script |

Semua file (kecuali `Code.gs`) harus berada **dalam satu folder** dan dibuka lewat web server (bukan double-click file), karena saling memanggil satu sama lain.

## Langkah Setup

### 1. Backend (Google Apps Script)
1. Buka spreadsheet: `https://docs.google.com/spreadsheets/d/1A9zJC2ROfRCNz6FRONTM00xr3Ez-3V74H1S_-dcwtG8/edit`
2. **Extensions > Apps Script**
3. Hapus isi default, tempel seluruh isi `Code.gs`
4. **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin URL yang diakhiri `/exec`

### 2. Frontend
1. Buka `config.js`
2. Ganti:
   ```js
   GAS_URL: 'GANTI_DENGAN_URL_WEB_APP_APPS_SCRIPT_ANDA',
   ```
   dengan URL dari langkah sebelumnya.
3. Upload folder ini ke hosting (GitHub Pages, Netlify, Google Sites, dll) — **jangan** dibuka langsung dari File Explorer (`file://`), karena browser akan memblokir permintaan jaringan (`NetworkError`).

## Mode Demo / Offline
Selama `GAS_URL` masih default atau gagal diakses, aplikasi otomatis menampilkan data dari `data.json` (mode baca-saja, tidak tersimpan). Ini berguna untuk mengecek tampilan UI sebelum backend siap. Matikan lewat `config.js`:
```js
USE_LOCAL_FALLBACK: false
```

## Troubleshooting "NetworkError" / "Gagal menyimpan data"
1. Pastikan `GAS_URL` sudah diisi URL asli (bukan placeholder).
2. URL harus diakhiri `/exec`, bukan `/dev`.
3. Di Apps Script: **Deploy > Manage deployments** — pastikan *Who has access* = **Anyone**.
4. Tes URL langsung di address bar browser — harus muncul JSON `{"isOk":true,"data":[...]}`.
5. Pastikan halaman dibuka via `http://` / `https://`, bukan `file://`.
6. Setiap mengubah `Code.gs`, buat **New version** lewat Manage deployments agar perubahan ter-publish.
