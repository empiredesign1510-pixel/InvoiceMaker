# InvoiceKu — Upgrade UI v3

Aplikasi invoice online statis, mobile-first, siap deploy ke GitHub + Vercel.

## Upgrade v3
- Landing page editorial/product style yang lebih natural dan tidak terasa seperti template AI generik.
- Light mode + dark mode, tersimpan di localStorage dan mengikuti preferensi sistem saat belum pernah dipilih.
- Brand mark berasal dari logo yang diberikan dan otomatis menjadi hitam/putih mengikuti tema.
- Dashboard, onboarding, galeri template, modal, form, dan navigasi ikut mendukung dark mode.
- Dokumen invoice tetap putih saat preview/export agar PDF/PNG aman untuk cetak.
- 288 template dengan preview mini invoice nyata.
- Mobile-first: bottom navigation, form responsif, preview A4 auto-fit.
- Created by xdaniel04 di landing page dan tertaut ke Instagram.
- html2canvas + jsPDF di-load secara lazy hanya ketika export digunakan.
- Audit dead code: function terpakai semua, async redundan dibersihkan, CSS landing lama yang sudah tidak dipakai dihapus.
- Service worker cache v3 dan asset logo/icon baru.

## Struktur
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `vercel.json`
- `assets/brand-mark.png`
- `assets/icon-192.png`
- `assets/icon-512.png`

## Deploy
Upload seluruh isi folder ini ke repository GitHub, lalu import repository ke Vercel. Tidak membutuhkan npm install atau build command.
