InvoiceKu v6.4 — Full-Screen Video Landing Hero

Perubahan:
- Video tidak lagi berada dalam kotak di sisi kanan.
- Hero landing page sekarang full-screen/full-width dengan video sebagai background.
- Navbar, headline, tombol, dan trust points menjadi overlay di atas video.
- Light mode = landing-light.mp4.
- Dark mode = landing-dark.mp4.
- Perpindahan tema menggunakan opacity crossfade; tidak mengganti src saat toggle.
- Desktop: video cover seluruh hero.
- Mobile: video contain/utuh di bagian bawah hero supaya tidak terpotong.
- Video berhenti saat hero tidak terlihat untuk mengurangi penggunaan resource.

Jika v6.3 Video Landing SUDAH terpasang, cukup replace 3 file:
1. index.html
2. js/landing-theme-video.js
3. sw.js

Folder assets/videos tidak perlu di-upload ulang.
Tidak ada SQL baru.
