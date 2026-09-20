// InvoiceKu Cloud - Supabase configuration
// Publishable key aman digunakan di browser bersama Row Level Security (RLS).
// Jangan pernah menaruh secret key / service_role key di file frontend.
window.INVOICEKU_CONFIG = {
  supabaseUrl: 'https://sgoucomufljzgyhtqpor.supabase.co',
  supabasePublishableKey: 'sb_publishable_82-8zkVKEeTqF1n1nvxo8g_meqHg50K',
  // Dikosongkan agar otomatis mengikuti domain aktif (Vercel/custom domain).
  publicSiteUrl: ''
};
