(() => {
  'use strict';
  const cfg = window.INVOICEKU_CONFIG || {};
  let client = null;
  let currentUser = null;
  let realtimeChannel = null;
  let activeBusiness = null;
  const businessKey = () => `invoiceku_active_business_${currentUser?.id || 'guest'}`;

  const configured = () => Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase?.createClient);
  function init(){
    if(!configured()) return null;
    if(client) return client;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }
  async function session(){ if(!init())return null; const {data,error}=await client.auth.getSession(); if(error)throw error; currentUser=data.session?.user||null; return data.session||null; }
  const user=()=>currentUser;
  const uid=()=>currentUser?.id||null;
  function requireUser(){ if(!uid())throw new Error('Silakan masuk terlebih dahulu.'); return uid(); }
  function isMissingRelation(err){ return ['42P01','PGRST205'].includes(err?.code) || /does not exist|schema cache/i.test(err?.message||''); }
  function withBusiness(query){ return activeBusiness ? query.eq('business_id',activeBusiness) : query; }

  async function signIn(email,password){ init(); const {data,error}=await client.auth.signInWithPassword({email,password}); if(error)throw error; currentUser=data.user; return data; }
  async function signUp(email,password){ init(); const options=cfg.publicSiteUrl?{emailRedirectTo:cfg.publicSiteUrl}:undefined; const {data,error}=await client.auth.signUp({email,password,options}); if(error)throw error; currentUser=data.user; return data; }
  async function resetPassword(email){ init(); const redirectTo=cfg.publicSiteUrl||`${location.origin}${location.pathname}`; const {data,error}=await client.auth.resetPasswordForEmail(email,{redirectTo}); if(error)throw error; return data; }
  async function updatePassword(password){ init(); const {data,error}=await client.auth.updateUser({password}); if(error)throw error; return data; }
  async function signOut(){ if(!client)return; const {error}=await client.auth.signOut(); if(error)throw error; currentUser=null; activeBusiness=null; }
  function onAuthChange(cb){ if(!init())return {data:{subscription:{unsubscribe(){}}}}; return client.auth.onAuthStateChange((event,s)=>{currentUser=s?.user||null; cb(event,s);}); }

  // ---------- Multi business ----------
  async function listBusinesses(){
    requireUser();
    const {data,error}=await client.from('businesses').select('*').eq('user_id',uid()).order('is_default',{ascending:false}).order('created_at');
    if(error){ if(isMissingRelation(error))return []; throw error; }
    return data||[];
  }
  function setActiveBusiness(id){ activeBusiness=id||null; if(currentUser&&id)localStorage.setItem(businessKey(),id); return activeBusiness; }
  const activeBusinessId=()=>activeBusiness;
  function businessToLegacy(row){
    if(!row)return null;
    return {...row,business_id:row.id,user_id:row.user_id,business_name:row.name,logo_url:row.logo_url||'',signature_url:row.signature_url||'',qris_url:row.qris_url||''};
  }
  function profilePayloadToBusiness(payload){
    return {name:payload.business_name??payload.name??'',phone:payload.phone??'',address:payload.address??'',email:payload.email??'',website:payload.website??'',logo_url:payload.logo_url??'',signature_url:payload.signature_url??'',qris_url:payload.qris_url??'',bank_name:payload.bank_name??'',bank_account:payload.bank_account??'',bank_holder:payload.bank_holder??'',ewallet:payload.ewallet??'',invoice_pattern:payload.invoice_pattern||'INV/{YYYY}/{MM}/{SEQ4}',default_currency:payload.default_currency||'IDR',default_due_days:Number(payload.default_due_days??7),reminder_offsets:payload.reminder_offsets||undefined,reminder_message:payload.reminder_message||undefined};
  }
  async function getProfile(){
    requireUser();
    try{
      const businesses=await listBusinesses();
      if(businesses.length){
        const saved=localStorage.getItem(businessKey());
        const chosen=businesses.find(b=>b.id===saved)||businesses.find(b=>b.is_default)||businesses[0];
        setActiveBusiness(chosen.id);
        return businessToLegacy(chosen);
      }
    }catch(err){ if(!isMissingRelation(err))throw err; }
    const {data,error}=await client.from('profiles').select('*').eq('user_id',uid()).maybeSingle(); if(error)throw error; return data;
  }
  async function saveProfile(payload){
    requireUser();
    try{
      const row={...profilePayloadToBusiness(payload),user_id:uid()};
      let data,error;
      if(activeBusiness){ ({data,error}=await client.from('businesses').update(row).eq('id',activeBusiness).eq('user_id',uid()).select().single()); }
      else{
        const existing=await listBusinesses();
        if(existing.length){setActiveBusiness(existing[0].id);({data,error}=await client.from('businesses').update(row).eq('id',activeBusiness).select().single());}
        else {({data,error}=await client.from('businesses').insert({...row,is_default:true}).select().single()); if(data)setActiveBusiness(data.id);}
      }
      if(error)throw error;
      return businessToLegacy(data);
    }catch(err){
      if(!isMissingRelation(err))throw err;
      const row={...payload,user_id:uid()}; const {data,error}=await client.from('profiles').upsert(row,{onConflict:'user_id'}).select().single(); if(error)throw error; return data;
    }
  }
  async function saveBusiness(row){
    requireUser();
    const id=row.id; const payload={...profilePayloadToBusiness(row),user_id:uid(),is_default:Boolean(row.is_default)};
    let q=id?client.from('businesses').update(payload).eq('id',id).eq('user_id',uid()):client.from('businesses').insert(payload);
    const {data,error}=await q.select().single(); if(error)throw error; return data;
  }
  async function deleteBusiness(id){ requireUser(); const {error}=await client.from('businesses').delete().eq('id',id).eq('user_id',uid()); if(error)throw error; if(activeBusiness===id)activeBusiness=null; }

  async function uploadAsset(file,kind='asset'){
    requireUser(); if(!file)return ''; if(file.size>5*1024*1024)throw new Error('File maksimal 5 MB.');
    const ext=(file.name.split('.').pop()||'png').replace(/[^a-zA-Z0-9]/g,'').toLowerCase(); const path=`${uid()}/${kind}-${Date.now()}.${ext}`;
    const {error}=await client.storage.from('invoiceku-assets').upload(path,file,{upsert:false,cacheControl:'3600'}); if(error)throw error;
    return client.storage.from('invoiceku-assets').getPublicUrl(path).data.publicUrl;
  }

  // ---------- Customers / products ----------
  async function listCustomers(){ requireUser(); let q=client.from('customers').select('*').eq('user_id',uid()); q=withBusiness(q); const {data,error}=await q.order('name'); if(error)throw error; return data||[]; }
  async function saveCustomer(row){ requireUser(); const payload={...row,user_id:uid(),business_id:activeBusiness}; delete payload.id; let q=row.id?client.from('customers').update(payload).eq('id',row.id):client.from('customers').insert(payload); const {data,error}=await q.select().single(); if(error)throw error; return data; }
  async function deleteCustomer(id){const {error}=await client.from('customers').delete().eq('id',id);if(error)throw error;}
  async function bulkSaveCustomers(rows){ requireUser(); const payload=rows.map(r=>({...r,user_id:uid(),business_id:activeBusiness})); const {data,error}=await client.from('customers').insert(payload).select(); if(error)throw error; return data||[]; }
  async function listProducts(){requireUser();let q=client.from('products').select('*').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('name');if(error)throw error;return data||[];}
  async function saveProduct(row){requireUser();const payload={...row,user_id:uid(),business_id:activeBusiness};delete payload.id;let q=row.id?client.from('products').update(payload).eq('id',row.id):client.from('products').insert(payload);const {data,error}=await q.select().single();if(error)throw error;return data;}
  async function deleteProduct(id){const {error}=await client.from('products').delete().eq('id',id);if(error)throw error;}
  async function bulkSaveProducts(rows){requireUser();const payload=rows.map(r=>({...r,user_id:uid(),business_id:activeBusiness}));const {data,error}=await client.from('products').insert(payload).select();if(error)throw error;return data||[];}

  // ---------- Invoices ----------
  async function claimInvoiceNumber(date){requireUser();const {data,error}=await client.rpc('claim_invoice_number',{p_date:date,p_business_id:activeBusiness});if(error)throw error;return data;}
  async function listInvoicesPage(page=0,pageSize=50){requireUser();const from=Math.max(0,page)*pageSize,to=from+pageSize-1;let q=client.from('invoices').select('*, payments(amount,method,paid_at), invoice_views(viewed_at)',{count:'exact'}).eq('user_id',uid());q=withBusiness(q);const {data,error,count}=await q.order('invoice_date',{ascending:false}).range(from,to);if(error)throw error;return {data:data||[],count:count||0,page,pageSize};}
  async function listInvoices(limit=500){
    requireUser(); let q=client.from('invoices').select('*, payments(amount,method,paid_at,note), invoice_views(viewed_at), payment_proofs(id,status,amount,submitted_at,file_url,payer_name,note)').eq('user_id',uid()); q=withBusiness(q);
    const {data,error}=await q.order('invoice_date',{ascending:false}).order('created_at',{ascending:false}).limit(limit); if(error)throw error;return data||[];
  }
  async function getInvoice(id){requireUser();const {data,error}=await client.from('invoices').select('*, payments(*), invoice_views(*), payment_proofs(*)').eq('id',id).eq('user_id',uid()).single();if(error)throw error;return data;}
  async function saveInvoice(row){
    requireUser();const payload={...row,user_id:uid(),business_id:activeBusiness};delete payload.payments;delete payload.invoice_views;delete payload.payment_proofs;
    let q;if(row.id){const id=row.id;delete payload.id;delete payload.public_token;q=client.from('invoices').update(payload).eq('id',id).eq('user_id',uid());}else{delete payload.id;q=client.from('invoices').insert(payload);}
    const {data,error}=await q.select().single();if(error)throw error;return data;
  }
  async function deleteInvoice(id){const {error}=await client.from('invoices').delete().eq('id',id);if(error)throw error;}
  async function bulkInvoicePatch(ids,patch){requireUser();if(!ids.length)return[];const {data,error}=await client.from('invoices').update(patch).in('id',ids).eq('user_id',uid()).select();if(error)throw error;return data||[];}
  async function addPayment(invoiceId,amount,method,note){requireUser();const {data,error}=await client.from('payments').insert({user_id:uid(),invoice_id:invoiceId,amount,method,note}).select().single();if(error)throw error;return data;}
  async function getPublicInvoice(token){init();const {data,error}=await client.rpc('get_public_invoice',{p_token:token});if(error)throw error;return data;}
  async function recordInvoiceView(token){init();const {error}=await client.rpc('record_invoice_view',{p_token:token});if(error)console.warn(error);}
  async function listInvoiceVersions(invoiceId){requireUser();const {data,error}=await client.from('invoice_versions').select('*').eq('invoice_id',invoiceId).order('version_no',{ascending:false}).limit(30);if(error)throw error;return data||[];}
  async function listActivity(limit=100){requireUser();let q=client.from('activity_logs').select('*, invoices(number,customer_snapshot)').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[];}

  // ---------- Quotation / receipt ----------
  async function claimQuoteNumber(date){requireUser();const {data,error}=await client.rpc('claim_quote_number',{p_date:date,p_business_id:activeBusiness});if(error)throw error;return data;}
  async function listQuotes(){requireUser();let q=client.from('quotes').select('*').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('quote_date',{ascending:false});if(error)throw error;return data||[];}
  async function saveQuote(row){requireUser();const payload={...row,user_id:uid(),business_id:activeBusiness};let q;if(row.id){const id=row.id;delete payload.id;delete payload.public_token;q=client.from('quotes').update(payload).eq('id',id);}else{delete payload.id;q=client.from('quotes').insert(payload);}const {data,error}=await q.select().single();if(error)throw error;return data;}
  async function deleteQuote(id){const {error}=await client.from('quotes').delete().eq('id',id);if(error)throw error;}
  async function claimReceiptNumber(date){requireUser();const {data,error}=await client.rpc('claim_receipt_number',{p_date:date,p_business_id:activeBusiness});if(error)throw error;return data;}
  async function listReceipts(){requireUser();let q=client.from('receipts').select('*, invoices(number,customer_snapshot,currency)').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('receipt_date',{ascending:false});if(error)throw error;return data||[];}
  async function saveReceipt(row){requireUser();const payload={...row,user_id:uid(),business_id:activeBusiness};const {data,error}=await client.from('receipts').insert(payload).select().single();if(error)throw error;return data;}

  // ---------- Payment proof portal ----------
  async function uploadPublicProof(token,file){
    init();if(!file)throw new Error('Pilih file bukti pembayaran.');if(file.size>5*1024*1024)throw new Error('File maksimal 5 MB.');
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();const path=`${token}/${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
    const {error}=await client.storage.from('invoiceku-proofs').upload(path,file,{upsert:false,cacheControl:'3600'});if(error)throw error;return client.storage.from('invoiceku-proofs').getPublicUrl(path).data.publicUrl;
  }
  async function submitPublicProof(token,fileUrl,amount,payerName,note){init();const {data,error}=await client.rpc('submit_public_payment_proof',{p_token:token,p_file_url:fileUrl,p_amount:Number(amount)||0,p_payer_name:payerName||'',p_note:note||''});if(error)throw error;return data;}
  async function listPaymentProofs(){requireUser();let q=client.from('payment_proofs').select('*, invoices(number,currency,customer_snapshot,total)').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('submitted_at',{ascending:false});if(error)throw error;return data||[];}
  async function reviewPaymentProof(id,status){requireUser();const {data,error}=await client.from('payment_proofs').update({status,reviewed_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid()).select('*, invoices(*)').single();if(error)throw error;return data;}

  // ---------- Recurring / notification ----------
  async function listRecurring(){requireUser();let q=client.from('recurring_rules').select('*, customers(name,phone)').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('created_at',{ascending:false});if(error)throw error;return data||[];}
  async function saveRecurring(row){requireUser();const id=row.id;const payload={...row,user_id:uid(),business_id:activeBusiness};delete payload.id;delete payload.customers;delete payload.created_at;delete payload.updated_at;let q=id?client.from('recurring_rules').update(payload).eq('id',id):client.from('recurring_rules').insert(payload);const {data,error}=await q.select().single();if(error)throw error;return data;}
  async function deleteRecurring(id){const {error}=await client.from('recurring_rules').delete().eq('id',id);if(error)throw error;}
  async function listNotifications(){requireUser();let q=client.from('notifications').select('*, invoices(number,customer_snapshot,status,due_date,total,currency)').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('created_at',{ascending:false}).limit(150);if(error)throw error;return data||[];}
  async function markNotification(id){const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw error;}
  async function markAllNotifications(){let q=client.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',uid()).is('read_at',null);q=withBusiness(q);const {error}=await q;if(error)throw error;}

  // ---------- Templates ----------
  async function listTemplatePreferences(){const {data,error}=await client.from('template_preferences').select('*').eq('user_id',uid());if(error)throw error;return data||[];}
  async function saveTemplatePreference(templateId,patch){requireUser();const row={user_id:uid(),template_id:templateId,...patch};const {data,error}=await client.from('template_preferences').upsert(row,{onConflict:'user_id,template_id'}).select().single();if(error)throw error;return data;}
  async function listCustomTemplates(){requireUser();let q=client.from('custom_templates').select('*').eq('user_id',uid());q=withBusiness(q);const {data,error}=await q.order('created_at',{ascending:false});if(error)throw error;return data||[];}
  async function saveCustomTemplate(row){requireUser();const payload={...row,user_id:uid(),business_id:activeBusiness};delete payload.id;let q=row.id?client.from('custom_templates').update(payload).eq('id',row.id):client.from('custom_templates').insert(payload);const {data,error}=await q.select().single();if(error)throw error;return data;}
  async function deleteCustomTemplate(id){const {error}=await client.from('custom_templates').delete().eq('id',id);if(error)throw error;}

  // ---------- Backup / restore ----------
  async function restoreBundle(bundle){
    requireUser();
    const result={businesses:0,customers:0,products:0,invoices:0,payments:0,recurring:0,templates:0,quotes:0,receipts:0};
    const clean=(row,drop=[])=>{const out={...row};['created_at','updated_at',...drop].forEach(k=>delete out[k]);out.user_id=uid();return out;};
    if(Array.isArray(bundle.businesses)&&bundle.businesses.length){
      const rows=bundle.businesses.map(r=>clean(r)).map(r=>({...r,user_id:uid()}));
      const {error}=await client.from('businesses').upsert(rows,{onConflict:'id'});if(error)throw error;result.businesses=rows.length;
    }
    const fallbackBusiness=activeBusiness || bundle.businesses?.[0]?.id || null;
    if(Array.isArray(bundle.customers)&&bundle.customers.length){const rows=bundle.customers.map(r=>({...clean(r),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('customers').upsert(rows,{onConflict:'id'});if(error)throw error;result.customers=rows.length;}
    if(Array.isArray(bundle.products)&&bundle.products.length){const rows=bundle.products.map(r=>({...clean(r),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('products').upsert(rows,{onConflict:'id'});if(error)throw error;result.products=rows.length;}
    if(Array.isArray(bundle.invoices)&&bundle.invoices.length){
      const paymentRows=[];const rows=bundle.invoices.map(r=>{(r.payments||[]).forEach(p=>paymentRows.push({...p,invoice_id:r.id,user_id:uid()}));const x=clean(r,['payments','invoice_views','payment_proofs']);x.business_id=r.business_id||fallbackBusiness;return x;});
      const {error}=await client.from('invoices').upsert(rows,{onConflict:'id'});if(error)throw error;result.invoices=rows.length;
      if(paymentRows.length){const dedup=paymentRows.map(({id,...p})=>p);const {error:pe}=await client.from('payments').insert(dedup);if(!pe)result.payments=dedup.length;}
    }
    if(Array.isArray(bundle.recurring)&&bundle.recurring.length){const rows=bundle.recurring.map(r=>({...clean(r,['customers']),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('recurring_rules').upsert(rows,{onConflict:'id'});if(error)throw error;result.recurring=rows.length;}
    if(Array.isArray(bundle.customTemplates)&&bundle.customTemplates.length){const rows=bundle.customTemplates.map(r=>({...clean(r),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('custom_templates').upsert(rows,{onConflict:'id'});if(error)throw error;result.templates=rows.length;}
    if(Array.isArray(bundle.quotes)&&bundle.quotes.length){const rows=bundle.quotes.map(r=>({...clean(r),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('quotes').upsert(rows,{onConflict:'id'});if(error)throw error;result.quotes=rows.length;}
    if(Array.isArray(bundle.receipts)&&bundle.receipts.length){const rows=bundle.receipts.map(r=>({...clean(r,['invoices']),business_id:r.business_id||fallbackBusiness}));const {error}=await client.from('receipts').upsert(rows,{onConflict:'id'});if(error)throw error;result.receipts=rows.length;}
    return result;
  }


  // ---------- Realtime ----------
  function subscribe(onChange){
    if(!client||!uid())return;if(realtimeChannel)client.removeChannel(realtimeChannel);
    realtimeChannel=client.channel(`invoiceku-${uid()}-${activeBusiness||'all'}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'invoices',filter:`user_id=eq.${uid()}`},p=>onChange('invoices',p))
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${uid()}`},p=>onChange('notifications',p))
      .on('postgres_changes',{event:'*',schema:'public',table:'payment_proofs',filter:`user_id=eq.${uid()}`},p=>onChange('payment_proofs',p))
      .subscribe();
  }
  function unsubscribe(){if(client&&realtimeChannel){client.removeChannel(realtimeChannel);realtimeChannel=null;}}

  window.InvoiceCloud={configured,session,user,uid,signIn,signUp,resetPassword,updatePassword,signOut,onAuthChange,
    listBusinesses,setActiveBusiness,activeBusinessId,getProfile,saveProfile,saveBusiness,deleteBusiness,uploadAsset,
    listCustomers,saveCustomer,deleteCustomer,bulkSaveCustomers,listProducts,saveProduct,deleteProduct,bulkSaveProducts,
    claimInvoiceNumber,listInvoicesPage,listInvoices,getInvoice,saveInvoice,deleteInvoice,bulkInvoicePatch,addPayment,getPublicInvoice,recordInvoiceView,listInvoiceVersions,listActivity,
    claimQuoteNumber,listQuotes,saveQuote,deleteQuote,claimReceiptNumber,listReceipts,saveReceipt,
    uploadPublicProof,submitPublicProof,listPaymentProofs,reviewPaymentProof,
    listRecurring,saveRecurring,deleteRecurring,listNotifications,markNotification,markAllNotifications,
    listTemplatePreferences,saveTemplatePreference,listCustomTemplates,saveCustomTemplate,deleteCustomTemplate,restoreBundle,subscribe,unsubscribe};
})();
