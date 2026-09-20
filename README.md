# InvoiceKu

InvoiceKu adalah MVP pembuat invoice online berbasis HTML/CSS/JavaScript tanpa build step.

## Fitur
- Onboarding profil usaha: logo, nama, alamat, HP, email, website, tanda tangan digital.
- 144 template invoice (12 palet × 12 layout).
- Editor item, qty, harga, diskon, pajak, ongkir, catatan, dan pembayaran.
- Preview realtime.
- Download PNG resolusi tinggi dan PDF A4.
- Simpan riwayat invoice di LocalStorage.
- PWA/installable.
- Responsive untuk HP.

## Jalankan lokal
Buka `index.html`, atau gunakan server statis sederhana.

## Deploy ke Vercel
1. Upload semua file ke satu repository GitHub.
2. Import repository di Vercel.
3. Framework Preset: **Other**.
4. Build Command: kosong.
5. Output Directory: kosong / `.`.
6. Deploy.

## Catatan produksi
Versi ini menyimpan profil dan invoice di browser pengguna. Untuk aplikasi SaaS multi-device, tambahkan autentikasi dan database (misalnya Supabase/Firebase/Convex) tanpa perlu Firebase Storage jika logo/signature dikompresi dan disimpan sebagai data URL kecil atau memakai object storage eksternal.
