INVOICEKU v6.3 — VIDEO LANDING THEME

Yang di-upgrade:
- Hero landing page menggunakan video.
- Light mode = landing-light.mp4.
- Dark mode = landing-dark.mp4.
- Toggle tema menggunakan crossfade opacity; video tidak mengganti src saat toggle.
- Versi mobile 854x480 terpisah agar lebih ringan dan tetap 16:9 tanpa crop.
- object-fit: contain untuk HP maupun PC.
- Video pause otomatis saat hero tidak terlihat untuk menghemat CPU/GPU/baterai.
- Service worker v6.3 memakai network-first untuk navigasi dan melewatkan MP4 range request agar video stabil di Safari/iPhone.

UPLOAD KE GITHUB, replace/tambah hanya:
1. index.html                              (REPLACE)
2. sw.js                                   (REPLACE)
3. js/landing-theme-video.js               (BARU)
4. assets/videos/landing-light.mp4         (BARU)
5. assets/videos/landing-dark.mp4          (BARU)
6. assets/videos/landing-light-mobile.mp4  (BARU)
7. assets/videos/landing-dark-mobile.mp4   (BARU)
8. assets/videos/landing-light-poster.webp (BARU)
9. assets/videos/landing-dark-poster.webp  (BARU)
10. assets/videos/landing-light-mobile-poster.webp (BARU)
11. assets/videos/landing-dark-mobile-poster.webp  (BARU)

Tidak perlu upload ulang:
- styles.css
- js/app.js
- js/cloud.js
- js/business-suite.js
- js/config.js
- js/templates.js
- js/invoice-renderer.js
- manifest.webmanifest
- supabase/

Tidak ada SQL baru.
