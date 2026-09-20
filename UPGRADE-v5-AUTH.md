# InvoiceKu v5 — Auth Upgrade

Versi ini memperbaiki alur login/daftar tanpa mengubah skema database.

## Perubahan aplikasi

- Google OAuth dicek lebih dulu melalui endpoint Auth settings. Jika provider Google belum aktif, pengguna tetap berada di modal InvoiceKu dan tidak diarahkan ke halaman JSON error.
- Setelah Google provider aktif, tombol Google otomatis bisa digunakan tanpa perubahan source code lagi.
- Logout tersedia di sidebar desktop, Pengaturan > Akun, dan menu Lainnya di HP. Setelah logout pengguna kembali ke landing page.
- Form Daftar memiliki checkbox persetujuan wajib.
- Jika konfirmasi email dinonaktifkan di Auth backend, signup email/password langsung mendapat session dan pengguna langsung masuk.
- Nama backend/database dihapus dari landing page, onboarding, dashboard, recurring, dan pengaturan yang dilihat pengguna.

## Agar Google Login benar-benar aktif

Di dashboard project:

1. Buka Authentication > Providers / Sign In > Google.
2. Aktifkan Google.
3. Masukkan Google OAuth Client ID dan Client Secret dari Google Cloud Console.
4. Authorized redirect URI pada Google harus memakai callback project:
   `https://sgoucomufljzgyhtqpor.supabase.co/auth/v1/callback`
5. Di Authentication > URL Configuration, isi Site URL dengan domain Vercel InvoiceKu dan tambahkan domain tersebut ke Redirect URLs.

## Agar daftar tanpa verifikasi email

Di dashboard project:

1. Buka Authentication > Providers / Sign In > Email.
2. Pastikan Email provider aktif.
3. Nonaktifkan `Confirm email` / `Email confirmations`.

Sesudah opsi itu OFF, `signUp()` akan mengembalikan session sehingga akun baru langsung login tanpa membuka email.
