INVOICEKU — LANDING THEME VIDEO PATCH

Tujuan:
- Light mode memakai assets/videos/landing-light.mp4
- Dark mode memakai assets/videos/landing-dark.mp4
- Perpindahan theme menggunakan crossfade opacity, BUKAN mengganti src video.
- Kedua video preload lebih awal sehingga toggle theme tidak freeze.
- HP memakai object-fit: contain sehingga video 16:9 tidak terpotong.
- Video tanpa audio untuk menghemat bandwidth dan menjaga autoplay mobile.

File asset sudah dioptimasi dari sekitar 30 MB total menjadi sekitar 3 MB total:
- landing-light.mp4 ~1.9 MB
- landing-dark.mp4 ~0.9 MB
- poster WebP untuk first paint

Integrasi ke project InvoiceKu terbaru:
1. Copy folder assets/videos ke project.
2. Copy js/landing-theme-video.js ke project.
3. Tambahkan sebelum </body> pada index.html:
   <script src="js/landing-theme-video.js"></script>
4. Naikkan versi CACHE di sw.js supaya asset lama tidak nyangkut.
5. Pastikan hero landing masih mempunyai container .hero-product-shell.

CATATAN:
Agar saya merge otomatis ke project dan mengirim PATCH yang tinggal upload ke GitHub,
upload ZIP project InvoiceKu terbaru (versi yang sekarang live di invoicekumaker.vercel.app).
