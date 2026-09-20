(() => {
  const cfg = window.INVOICEKU_CONFIG || {};
  let client = null;
  let currentUser = null;
  let realtimeChannel = null;

  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase?.createClient);

  function init(){
    if(!configured()) return null;
    if(client) return client;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }

  async function session(){
    if(!init()) return null;
    const {data,error} = await client.auth.getSession();
    if(error) throw error;
    currentUser = data.session?.user || null;
    return data.session || null;
  }

  function user(){ return currentUser; }
  function uid(){ return currentUser?.id || null; }
  function requireUser(){ if(!uid()) throw new Error('Silakan masuk terlebih dahulu.'); return uid(); }

  async function signIn(email,password){
    init();
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error;
    currentUser=data.user;
    return data;
  }
  async function signUp(email,password){
    init();
    const options = cfg.publicSiteUrl ? {emailRedirectTo:cfg.publicSiteUrl} : undefined;
    const {data,error}=await client.auth.signUp({email,password,options});
    if(error) throw error;
    currentUser=data.user;
    return data;
  }
  async function signInGoogle(){
    init();
    const redirectTo = cfg.publicSiteUrl || `${location.origin}${location.pathname}`;
    const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
    if(error) throw error;
    return data;
  }
  async function resetPassword(email){
    init();
    const redirectTo = cfg.publicSiteUrl || `${location.origin}${location.pathname}`;
    const {data,error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
    if(error) throw error;
    return data;
  }
  async function updatePassword(password){
    init();
    const {data,error}=await client.auth.updateUser({password});
    if(error) throw error;
    return data;
  }
  async function signOut(){
    if(!client) return;
    const {error}=await client.auth.signOut();
    if(error) throw error;
    currentUser=null;
  }
  function onAuthChange(cb){
    if(!init()) return {data:{subscription:{unsubscribe(){}}}};
    return client.auth.onAuthStateChange((event,s)=>{ currentUser=s?.user||null; cb(event,s); });
  }

  async function getProfile(){
    requireUser();
    const {data,error}=await client.from('profiles').select('*').eq('user_id',uid()).maybeSingle();
    if(error) throw error;
    return data;
  }
  async function saveProfile(payload){
    requireUser();
    const row={...payload,user_id:uid()};
    const {data,error}=await client.from('profiles').upsert(row,{onConflict:'user_id'}).select().single();
    if(error) throw error;
    return data;
  }
  async function uploadAsset(file,kind='asset'){
    requireUser();
    if(!file) return '';
    if(file.size>5*1024*1024) throw new Error('File maksimal 5 MB.');
    const ext=(file.name.split('.').pop()||'png').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
    const path=`${uid()}/${kind}-${Date.now()}.${ext}`;
    const {error}=await client.storage.from('invoiceku-assets').upload(path,file,{upsert:false,cacheControl:'3600'});
    if(error) throw error;
    const {data}=client.storage.from('invoiceku-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function listCustomers(){
    requireUser();
    const {data,error}=await client.from('customers').select('*').order('name');
    if(error) throw error;
    return data||[];
  }
  async function saveCustomer(row){
    requireUser();
    const payload={...row,user_id:uid()};
    let query=row.id?client.from('customers').update(payload).eq('id',row.id):client.from('customers').insert(payload);
    const {data,error}=await query.select().single(); if(error) throw error; return data;
  }
  async function deleteCustomer(id){ const {error}=await client.from('customers').delete().eq('id',id); if(error) throw error; }

  async function listProducts(){
    requireUser();
    const {data,error}=await client.from('products').select('*').order('name'); if(error) throw error; return data||[];
  }
  async function saveProduct(row){
    requireUser(); const payload={...row,user_id:uid()}; delete payload.id;
    let query=row.id?client.from('products').update(payload).eq('id',row.id):client.from('products').insert(payload);
    const {data,error}=await query.select().single(); if(error) throw error; return data;
  }
  async function deleteProduct(id){ const {error}=await client.from('products').delete().eq('id',id); if(error) throw error; }

  async function claimInvoiceNumber(date){
    requireUser();
    const {data,error}=await client.rpc('claim_invoice_number',{p_date:date});
    if(error) throw error;
    return data;
  }
  async function listInvoices(limit=250){
    requireUser();
    const {data,error}=await client.from('invoices').select('*, payments(amount,method,paid_at)').order('invoice_date',{ascending:false}).order('created_at',{ascending:false}).limit(limit);
    if(error) throw error; return data||[];
  }
  async function getInvoice(id){
    requireUser();
    const {data,error}=await client.from('invoices').select('*, payments(*)').eq('id',id).single(); if(error) throw error; return data;
  }
  async function saveInvoice(row){
    requireUser();
    const payload={...row,user_id:uid()}; delete payload.payments;
    let query;
    if(row.id){ const id=row.id; delete payload.id; delete payload.public_token; query=client.from('invoices').update(payload).eq('id',id); }
    else { delete payload.id; query=client.from('invoices').insert(payload); }
    const {data,error}=await query.select().single(); if(error) throw error; return data;
  }
  async function deleteInvoice(id){ const {error}=await client.from('invoices').delete().eq('id',id); if(error) throw error; }
  async function addPayment(invoiceId,amount,method,note){
    requireUser();
    const {data,error}=await client.from('payments').insert({user_id:uid(),invoice_id:invoiceId,amount,method,note}).select().single();
    if(error) throw error; return data;
  }
  async function getPublicInvoice(token){
    init();
    const {data,error}=await client.rpc('get_public_invoice',{p_token:token}); if(error) throw error; return data;
  }

  async function listRecurring(){ const {data,error}=await client.from('recurring_rules').select('*, customers(name,phone)').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
  async function saveRecurring(row){
    requireUser();
    const id=row.id;
    const payload={...row,user_id:uid()};
    delete payload.id;
    delete payload.customers;
    delete payload.created_at;
    delete payload.updated_at;
    let q=id?client.from('recurring_rules').update(payload).eq('id',id):client.from('recurring_rules').insert(payload);
    const {data,error}=await q.select().single(); if(error) throw error; return data;
  }
  async function deleteRecurring(id){ const {error}=await client.from('recurring_rules').delete().eq('id',id); if(error) throw error; }

  async function listNotifications(){ const {data,error}=await client.from('notifications').select('*, invoices(number,customer_snapshot,status,due_date,total,currency)').order('created_at',{ascending:false}).limit(100); if(error) throw error; return data||[]; }
  async function markNotification(id){ const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id); if(error) throw error; }
  async function markAllNotifications(){ const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).is('read_at',null); if(error) throw error; }

  async function listTemplatePreferences(){ const {data,error}=await client.from('template_preferences').select('*'); if(error) throw error; return data||[]; }
  async function saveTemplatePreference(templateId, patch){
    requireUser();
    const row={user_id:uid(),template_id:templateId,...patch};
    const {data,error}=await client.from('template_preferences').upsert(row,{onConflict:'user_id,template_id'}).select().single(); if(error) throw error; return data;
  }
  async function listCustomTemplates(){ const {data,error}=await client.from('custom_templates').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
  async function saveCustomTemplate(row){
    requireUser(); const payload={...row,user_id:uid()};
    let q=row.id?client.from('custom_templates').update(payload).eq('id',row.id):client.from('custom_templates').insert(payload);
    const {data,error}=await q.select().single(); if(error) throw error; return data;
  }
  async function deleteCustomTemplate(id){ const {error}=await client.from('custom_templates').delete().eq('id',id); if(error) throw error; }

  function subscribe(onChange){
    if(!client || !uid()) return;
    if(realtimeChannel) client.removeChannel(realtimeChannel);
    realtimeChannel=client.channel(`invoiceku-${uid()}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'invoices',filter:`user_id=eq.${uid()}`},payload=>onChange('invoices',payload))
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${uid()}`},payload=>onChange('notifications',payload))
      .subscribe();
  }
  function unsubscribe(){ if(client && realtimeChannel){ client.removeChannel(realtimeChannel); realtimeChannel=null; } }

  window.InvoiceCloud={configured,session,user,uid,signIn,signUp,signInGoogle,resetPassword,updatePassword,signOut,onAuthChange,getProfile,saveProfile,uploadAsset,listCustomers,saveCustomer,deleteCustomer,listProducts,saveProduct,deleteProduct,claimInvoiceNumber,listInvoices,getInvoice,saveInvoice,deleteInvoice,addPayment,getPublicInvoice,listRecurring,saveRecurring,deleteRecurring,listNotifications,markNotification,markAllNotifications,listTemplatePreferences,saveTemplatePreference,listCustomTemplates,saveCustomTemplate,deleteCustomTemplate,subscribe,unsubscribe};
})();
