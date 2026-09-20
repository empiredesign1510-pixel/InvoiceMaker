(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const T = window.InvoiceTemplates;
  const R = window.InvoiceRenderer;
  const Cloud = window.InvoiceCloud;
  const LOCAL = { theme:'invoiceku_theme', legacyProfile:'invoiceku_profile' };

  const state = {
    profile:null,
    customers:[],
    products:[],
    invoices:[],
    recurring:[],
    notifications:[],
    preferences:[],
    customTemplates:[],
    selectedTemplate:T.templates[0],
    draft:null,
    activeTab:'dashboard',
    activeTemplateFilter:'Semua',
    templateVisible:36,
    authMode:'login',
    autosaveTimer:null,
    autosaveBusy:false,
    undo:[],
    redo:[],
    realtimeRefreshTimer:null,
    deferredPrompt:null
  };

  const STATUS = {
    draft:'Draft', sent:'Terkirim', unpaid:'Belum dibayar', partial:'Sebagian dibayar',
    paid:'Lunas', overdue:'Jatuh tempo', cancelled:'Dibatalkan'
  };

  function safeJson(value,fallback=null){ try{return value?JSON.parse(value):fallback;}catch{return fallback;} }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function escape(value=''){ return T.escape(value); }
  function toast(message,type='default'){
    const el=$('#toast');
    if(!el) return;
    el.textContent=message;
    el.dataset.type=type;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function todayPlus(days=0){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
  function formatDate(value){ return R.date(value); }
  function money(value,currency='IDR'){ return R.money(value,currency); }
  function normalizePhone(phone=''){
    let p=String(phone).replace(/\D/g,'');
    if(p.startsWith('0')) p=`62${p.slice(1)}`;
    return p;
  }
  function shareBase(){ return (window.INVOICEKU_CONFIG?.publicSiteUrl || `${location.origin}${location.pathname}`).replace(/\/$/,''); }
  function publicLink(token){ return `${shareBase()}?invoice=${encodeURIComponent(token)}`; }
  function statusClass(status){ return `status-${status||'draft'}`; }
  function invoicePaid(invoice){ const sum=(invoice.payments||[]).reduce((total,p)=>total+(Number(p.amount)||0),0); return sum>0?sum:(invoice.status==='paid'?(Number(invoice.total)||0):0); }
  function remaining(invoice){ return Math.max(0,(Number(invoice.total)||0)-invoicePaid(invoice)); }
  function currentUserId(){ return Cloud.uid(); }
  function localDraftKey(){ return `invoiceku_cloud_draft_${currentUserId()||'guest'}`; }

  // ---------------- Theme ----------------
  function preferredTheme(){
    const saved=localStorage.getItem(LOCAL.theme);
    if(saved==='light'||saved==='dark') return saved;
    return matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function applyTheme(theme,persist=false){
    const next=theme==='dark'?'dark':'light';
    document.documentElement.dataset.theme=next;
    if(persist) localStorage.setItem(LOCAL.theme,next);
    $('#themeColorMeta')?.setAttribute('content',next==='dark'?'#0d0f10':'#f7f7f4');
    $$('[data-theme-toggle]').forEach(btn=>{ btn.setAttribute('aria-pressed',String(next==='dark')); const l=btn.querySelector('.theme-label'); if(l) l.textContent=next==='dark'?'Mode terang':'Mode gelap'; });
  }
  function toggleTheme(){ applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true); }
  applyTheme(preferredTheme());
  document.addEventListener('click',e=>{ if(e.target.closest('[data-theme-toggle]')) toggleTheme(); });
  matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',e=>{ if(!localStorage.getItem(LOCAL.theme)) applyTheme(e.matches?'dark':'light'); });

  // ---------------- Generic modal ----------------
  function openModal(id){ $(`#${id}`)?.classList.remove('hidden'); }
  function closeModal(id){ $(`#${id}`)?.classList.add('hidden'); }
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');
    if(close) closeModal(close.dataset.close);
    if(e.target.classList.contains('modal')) e.target.classList.add('hidden');
  });

  // ---------------- Landing ----------------
  function showOnly(id){
    ['setupRequired','publicInvoice','landing','onboarding','app'].forEach(x=>$(`#${x}`)?.classList.toggle('hidden',x!==id));
    if(id==='landing') window.scrollTo({top:0,behavior:'instant'});
  }
  function renderLandingTemplates(){
    const ids=['0-0','1-1','6-15'];
    $('#landingTemplateGrid').innerHTML=ids.map(id=>{
      const t=T.find(id);
      return `<article class="landing-template"><div class="template-thumb">${T.miniPreviewHtml(t)}</div><div class="landing-template-meta"><b>${escape(t.name)}</b><span>${escape(t.category)}</span></div></article>`;
    }).join('');
  }
  renderLandingTemplates();

  function requestAuth(){
    if(!Cloud.configured()){ showOnly('setupRequired'); return; }
    if(Cloud.user()){ bootstrapUser(); return; }
    openModal('authModal');
  }
  ['#landingLogin','#landingStart','#landingStartBottom','#showcaseCta'].forEach(sel=>$(sel)?.addEventListener('click',requestAuth));
  $('#backToLanding')?.addEventListener('click',()=>showOnly('landing'));
  $('#setupDemoBtn')?.addEventListener('click',()=>showOnly('landing'));

  // ---------------- Auth ----------------
  function setAuthMode(mode){
    state.authMode=mode;
    $$('[data-auth-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.authTab===mode));
    $('#authSubmit').textContent=mode==='login'?'Masuk':'Buat akun';
    $('#authPassword').autocomplete=mode==='login'?'current-password':'new-password';
    $('#authMessage').textContent='';
  }
  $$('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authTab)));
  $('#authForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#authEmail').value.trim();
    const password=$('#authPassword').value;
    $('#authSubmit').disabled=true;
    $('#authMessage').textContent='Menghubungkan...';
    try{
      if(state.authMode==='login'){
        await Cloud.signIn(email,password);
        closeModal('authModal');
        await bootstrapUser();
      }else{
        const result=await Cloud.signUp(email,password);
        if(result.session){ closeModal('authModal'); await bootstrapUser(); }
        else $('#authMessage').textContent='Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.';
      }
    }catch(err){ $('#authMessage').textContent=err.message||'Autentikasi gagal.'; }
    finally{$('#authSubmit').disabled=false;}
  });
  $('#googleLogin')?.addEventListener('click',async()=>{ try{ await Cloud.signInGoogle(); }catch(err){ toast(err.message,'error'); } });
  $('#forgotPassword')?.addEventListener('click',async()=>{
    const email=$('#authEmail').value.trim();
    if(!email){ $('#authMessage').textContent='Isi email terlebih dahulu.'; return; }
    try{ await Cloud.resetPassword(email); $('#authMessage').textContent='Link reset password sudah dikirim ke email.'; }
    catch(err){ $('#authMessage').textContent=err.message; }
  });
  $('#passwordForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await Cloud.updatePassword($('#newPassword').value);closeModal('passwordModal');$('#newPassword').value='';toast('Password berhasil diperbarui.');}catch(err){toast(err.message,'error');}});
  $('#signOutBtn')?.addEventListener('click',async()=>{ try{ Cloud.unsubscribe(); await Cloud.signOut(); resetState(); showOnly('landing'); toast('Anda sudah keluar.'); }catch(err){toast(err.message,'error');} });

  function resetState(){
    state.profile=null;state.customers=[];state.products=[];state.invoices=[];state.recurring=[];state.notifications=[];state.preferences=[];state.customTemplates=[];state.draft=null;state.undo=[];state.redo=[];
  }

  // ---------------- Profile & onboarding ----------------
  function profileToUi(row){
    if(!row) return null;
    return {
      userId:row.user_id,name:row.business_name||'',phone:row.phone||'',address:row.address||'',email:row.email||'',website:row.website||'',
      logo:row.logo_url||'',signature:row.signature_url||'',qris:row.qris_url||'',bankName:row.bank_name||'',bankAccount:row.bank_account||'',bankHolder:row.bank_holder||'',ewallet:row.ewallet||'',
      invoicePattern:row.invoice_pattern||'INV/{YYYY}/{MM}/{SEQ4}',invoiceCounter:Number(row.invoice_counter)||0,defaultCurrency:row.default_currency||'IDR',defaultDueDays:Number(row.default_due_days)||7
    };
  }
  function profileToDb(p){
    return {business_name:p.name,phone:p.phone,address:p.address,email:p.email||'',website:p.website||'',logo_url:p.logo||'',signature_url:p.signature||'',qris_url:p.qris||'',bank_name:p.bankName||'',bank_account:p.bankAccount||'',bank_holder:p.bankHolder||'',ewallet:p.ewallet||'',invoice_pattern:p.invoicePattern||'INV/{YYYY}/{MM}/{SEQ4}',default_currency:p.defaultCurrency||'IDR',default_due_days:Number(p.defaultDueDays)||7};
  }
  function previewFile(input,preview){
    const file=input.files?.[0];
    if(!file) return;
    if(file.size>5*1024*1024){ toast('File maksimal 5 MB','error'); input.value=''; return; }
    const url=URL.createObjectURL(file);
    preview.innerHTML=`<img src="${url}" alt="Preview">`;
  }
  [['logoInput','logoPreview'],['signatureInput','signaturePreview'],['settingsLogo','settingsLogoPreview'],['settingsSignature','settingsSignaturePreview'],['settingsQris','settingsQrisPreview']].forEach(([i,p])=>$('#'+i)?.addEventListener('change',()=>previewFile($('#'+i),$('#'+p))));

  function prefillOnboarding(){
    const legacy=safeJson(localStorage.getItem(LOCAL.legacyProfile),null);
    if(!legacy) return;
    $('#businessName').value=legacy.name||'';
    $('#businessPhone').value=legacy.phone||'';
    $('#businessAddress').value=legacy.address||'';
    $('#businessEmail').value=legacy.email||'';
    $('#businessWebsite').value=legacy.website||'';
  }
  $('#profileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=e.submitter; if(btn) btn.disabled=true;
    try{
      let logo='',signature='';
      if($('#logoInput').files[0]) logo=await Cloud.uploadAsset($('#logoInput').files[0],'logo');
      if($('#signatureInput').files[0]) signature=await Cloud.uploadAsset($('#signatureInput').files[0],'signature');
      const p={name:$('#businessName').value.trim(),phone:$('#businessPhone').value.trim(),address:$('#businessAddress').value.trim(),email:$('#businessEmail').value.trim(),website:$('#businessWebsite').value.trim(),logo,signature,qris:'',bankName:'',bankAccount:'',bankHolder:'',ewallet:'',invoicePattern:'INV/{YYYY}/{MM}/{SEQ4}',defaultCurrency:'IDR',defaultDueDays:7};
      state.profile=profileToUi(await Cloud.saveProfile(profileToDb(p)));
      await loadAllData();
      showOnly('app');
      switchTab('dashboard');
      await newInvoice(false);
      toast('Profil usaha tersimpan.');
    }catch(err){ toast(err.message||'Gagal menyimpan profil','error'); }
    finally{if(btn)btn.disabled=false;}
  });

  async function bootstrapUser(){
    try{
      const p=await Cloud.getProfile();
      if(!p){ prefillOnboarding(); showOnly('onboarding'); return; }
      state.profile=profileToUi(p);
      await loadAllData();
      showOnly('app');
      switchTab('dashboard');
      const cached=safeJson(localStorage.getItem(localDraftKey()),null);
      if(cached){ state.draft=cached; selectTemplateInternal(cached.templateId||'0-0',false); syncDraftToForm(); renderInvoice(); }
      else await newInvoice(false);
      Cloud.subscribe(handleRealtime);
    }catch(err){ console.error(err); toast(`Gagal memuat akun: ${err.message}`,'error'); }
  }

  async function loadAllData(){
    setCloudBusy(true);
    try{
      const [customers,products,invoices,recurring,notifications,prefs,custom]=await Promise.all([
        Cloud.listCustomers(),Cloud.listProducts(),Cloud.listInvoices(),Cloud.listRecurring(),Cloud.listNotifications(),Cloud.listTemplatePreferences(),Cloud.listCustomTemplates()
      ]);
      Object.assign(state,{customers,products,invoices,recurring,notifications,preferences:prefs,customTemplates:custom});
      renderAllData();
    }finally{ setCloudBusy(false); }
  }
  function setCloudBusy(busy){ $('#cloudState').textContent=busy?'Sinkronisasi...':'Tersambung'; $('#mobileSync')?.classList.toggle('busy',busy); }
  function handleRealtime(table){
    clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer=setTimeout(async()=>{
      try{
        if(table==='invoices') state.invoices=await Cloud.listInvoices();
        if(table==='notifications') state.notifications=await Cloud.listNotifications();
        renderDashboard();renderInvoices();renderNotifications();
      }catch(err){console.warn(err);}
    },350);
  }

  // ---------------- Tabs / mobile ----------------
  function switchTab(name){
    state.activeTab=name;
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    $$('.mobile-nav-item[data-mobile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileTab===name));
    $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`${name}Tab`));
    closeModal('moreSheet');
    if(name==='editor') requestAnimationFrame(fitInvoicePreview);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab]'); if(tab) switchTab(tab.dataset.tab);
    const mtab=e.target.closest('[data-mobile-tab]'); if(mtab) switchTab(mtab.dataset.mobileTab);
    const jump=e.target.closest('[data-jump]'); if(jump) switchTab(jump.dataset.jump);
    const more=e.target.closest('[data-more-tab]'); if(more){ $('#moreSheet').classList.add('hidden'); switchTab(more.dataset.moreTab); }
  });
  $('#openMoreNav')?.addEventListener('click',()=>$('#moreSheet').classList.remove('hidden'));
  $('#moreClose')?.addEventListener('click',()=>$('#moreSheet').classList.add('hidden'));

  // ---------------- Invoice draft / editor ----------------
  function emptyDraft(number){
    return {id:null,publicToken:null,number:number||'',status:'draft',date:todayPlus(0),due:todayPlus(state.profile?.defaultDueDays||7),currency:state.profile?.defaultCurrency||'IDR',customerId:'',customerName:'',customerPhone:'',customerEmail:'',customerAddress:'',items:[{productId:'',name:'Produk / Jasa',description:'',qty:1,unit:'pcs',price:100000}],discount:0,tax:0,shipping:0,paymentInfo:defaultPaymentInfo(),notes:'Terima kasih atas kepercayaan Anda.',templateId:state.selectedTemplate?.id||'0-0',publicEnabled:true,payments:[]};
  }
  function defaultPaymentInfo(){
    if(!state.profile) return '';
    const bank=[state.profile.bankName,state.profile.bankAccount,state.profile.bankHolder].filter(Boolean).join(' · ');
    return bank || state.profile.ewallet || '';
  }
  async function newInvoice(goEditor=true){
    try{
      const date=todayPlus(0);
      const number=await Cloud.claimInvoiceNumber(date);
      pushUndo(false);
      state.draft=emptyDraft(number);
      state.undo=[];state.redo=[];
      localStorage.setItem(localDraftKey(),JSON.stringify(state.draft));
      syncDraftToForm();renderInvoice();renderItems();renderPaymentSummary();
      if(goEditor) switchTab('editor');
      $('#editorTitle').textContent='Invoice baru';
      $('#autosaveState').textContent='Draft lokal';
    }catch(err){
      console.warn(err);
      state.draft=emptyDraft(`INV-${Date.now().toString().slice(-6)}`);
      syncDraftToForm();renderInvoice();renderItems();
      if(goEditor)switchTab('editor');
      toast('Nomor sementara dipakai. Simpan setelah koneksi tersedia.','error');
    }
  }
  $('#newInvoiceBtn')?.addEventListener('click',()=>newInvoice(true));
  $('#dashboardNewInvoice')?.addEventListener('click',()=>newInvoice(true));
  $('#invoiceListNew')?.addEventListener('click',()=>newInvoice(true));

  function pushUndo(clearRedo=true){
    if(!state.draft) return;
    state.undo.push(clone(state.draft));
    if(state.undo.length>40) state.undo.shift();
    if(clearRedo) state.redo=[];
  }
  function undo(){ if(!state.undo.length)return; state.redo.push(clone(state.draft)); state.draft=state.undo.pop(); syncDraftToForm();renderItems();renderInvoice();persistLocalDraft(); }
  function redo(){ if(!state.redo.length)return; state.undo.push(clone(state.draft)); state.draft=state.redo.pop(); syncDraftToForm();renderItems();renderInvoice();persistLocalDraft(); }
  $('#undoBtn')?.addEventListener('click',undo); $('#redoBtn')?.addEventListener('click',redo);

  const draftBindings={invoiceNumber:'number',invoiceStatus:'status',currency:'currency',invoiceDate:'date',dueDate:'due',customerName:'customerName',customerPhone:'customerPhone',customerEmail:'customerEmail',customerAddress:'customerAddress',discount:'discount',tax:'tax',shipping:'shipping',paymentInfo:'paymentInfo',notes:'notes'};
  Object.entries(draftBindings).forEach(([id,key])=>{
    const el=$(`#${id}`); if(!el)return;
    el.addEventListener('focus',()=>{el.dataset.before=JSON.stringify(state.draft?.[key]??'');},{passive:true});
    el.addEventListener('input',()=>{
      if(!state.draft)return;
      state.draft[key]=['discount','tax','shipping'].includes(key)?Number(el.value)||0:el.value;
      afterDraftChange();
    });
    el.addEventListener('change',()=>{
      if(el.dataset.before!==undefined && el.dataset.before!==JSON.stringify(state.draft?.[key]??'')){
        const prev=clone(state.draft); prev[key]=safeJson(el.dataset.before,el.dataset.before); state.undo.push(prev); if(state.undo.length>40)state.undo.shift(); state.redo=[];
      }
    });
  });
  $('#publicEnabled')?.addEventListener('change',()=>{ pushUndo(); state.draft.publicEnabled=$('#publicEnabled').checked; afterDraftChange(); });
  $('#customerSelect')?.addEventListener('change',()=>{
    const c=state.customers.find(x=>x.id===$('#customerSelect').value); if(!c)return;
    pushUndo(); Object.assign(state.draft,{customerId:c.id,customerName:c.name,customerPhone:c.phone||'',customerEmail:c.email||'',customerAddress:c.address||''}); syncCustomerFields(); afterDraftChange();
  });

  function syncCustomerFields(){
    $('#customerName').value=state.draft?.customerName||'';$('#customerPhone').value=state.draft?.customerPhone||'';$('#customerEmail').value=state.draft?.customerEmail||'';$('#customerAddress').value=state.draft?.customerAddress||'';$('#customerSelect').value=state.draft?.customerId||'';
  }
  function syncDraftToForm(){
    if(!state.draft)return;
    $('#invoiceNumber').value=state.draft.number||'';$('#invoiceStatus').value=state.draft.status||'draft';$('#currency').value=state.draft.currency||'IDR';$('#invoiceDate').value=state.draft.date||todayPlus(0);$('#dueDate').value=state.draft.due||todayPlus(7);$('#discount').value=state.draft.discount||0;$('#tax').value=state.draft.tax||0;$('#shipping').value=state.draft.shipping||0;$('#paymentInfo').value=state.draft.paymentInfo||'';$('#notes').value=state.draft.notes||'';$('#publicEnabled').checked=state.draft.publicEnabled!==false;syncCustomerFields();renderItems();renderPaymentSummary();
  }
  function afterDraftChange(){ persistLocalDraft(); renderInvoice(); queueAutosave(); }
  function persistLocalDraft(){ if(state.draft) localStorage.setItem(localDraftKey(),JSON.stringify(state.draft)); }
  function queueAutosave(){
    clearTimeout(state.autosaveTimer); $('#autosaveState').textContent=state.draft?.id?'Perubahan belum tersimpan':'Draft lokal';
    if(!state.draft?.id) return;
    state.autosaveTimer=setTimeout(()=>saveCurrentInvoice(true),1300);
  }

  function renderItems(){
    if(!state.draft)return;
    $('#itemsList').innerHTML=(state.draft.items||[]).map((item,index)=>`<div class="item-row-cloud" data-item-row="${index}">
      <div class="item-name-wrap"><select class="item-product" data-i="${index}"><option value="">Pilih produk / isi manual</option>${state.products.map(p=>`<option value="${p.id}" ${p.id===item.productId?'selected':''}>${escape(p.name)} · ${money(p.price,state.draft.currency)}</option>`).join('')}</select><input class="item-name" data-i="${index}" value="${escape(item.name||'')}" placeholder="Nama item"><input class="item-description" data-i="${index}" value="${escape(item.description||'')}" placeholder="Deskripsi opsional"></div>
      <label class="qty-wrap"><span>Qty</span><input class="item-qty" data-i="${index}" type="number" min="0" step="0.01" value="${Number(item.qty)||0}"></label>
      <label><span>Satuan</span><input class="item-unit" data-i="${index}" value="${escape(item.unit||'')}"></label>
      <label class="price-wrap"><span>Harga</span><input class="item-price" data-i="${index}" type="number" min="0" value="${Number(item.price)||0}"></label>
      <button class="remove-item" data-remove-item="${index}" type="button">×</button>
    </div>`).join('');
  }
  $('#itemsList')?.addEventListener('input',e=>{
    const el=e.target; const i=Number(el.dataset.i); if(Number.isNaN(i)||!state.draft?.items[i])return;
    const map={ 'item-name':'name','item-description':'description','item-qty':'qty','item-unit':'unit','item-price':'price' };
    const cls=Object.keys(map).find(c=>el.classList.contains(c)); if(!cls)return;
    state.draft.items[i][map[cls]]=['qty','price'].includes(map[cls])?Number(el.value)||0:el.value;
    afterDraftChange();
  });
  $('#itemsList')?.addEventListener('change',e=>{
    if(!e.target.classList.contains('item-product'))return;
    const i=Number(e.target.dataset.i),p=state.products.find(x=>x.id===e.target.value); if(!p)return;
    pushUndo(); state.draft.items[i]={productId:p.id,name:p.name,description:p.description||'',qty:1,unit:p.unit||'pcs',price:Number(p.price)||0}; renderItems();afterDraftChange();
  });
  $('#itemsList')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-remove-item]'); if(!btn)return;
    const i=Number(btn.dataset.removeItem); if(state.draft.items.length<=1){toast('Invoice minimal memiliki satu item.');return;}
    pushUndo(); state.draft.items.splice(i,1);renderItems();afterDraftChange();
  });
  $('#addItemBtn')?.addEventListener('click',()=>{pushUndo();state.draft.items.push({productId:'',name:'Item baru',description:'',qty:1,unit:'pcs',price:0});renderItems();afterDraftChange();});

  function renderInvoice(){
    if(!state.profile||!state.draft)return;
    state.selectedTemplate=T.find(state.draft.templateId||state.selectedTemplate.id,state.customTemplates);
    R.render($('#invoicePaper'),state.profile,state.draft,state.selectedTemplate);
    $('#currentTemplateName').textContent=state.selectedTemplate.name;
    requestAnimationFrame(fitInvoicePreview);
  }
  function fitInvoicePreview(){
    const stage=$('#paperStage'),canvas=$('#paperCanvas'); if(!stage||!canvas||!state.draft)return;
    const scale=Math.min(1,Math.max(0.2,(stage.clientWidth-20)/794));
    canvas.style.transform=`scale(${scale})`;canvas.style.height=`${1123*scale}px`;stage.style.minHeight=`${1123*scale+20}px`;
  }
  addEventListener('resize',()=>{requestAnimationFrame(fitInvoicePreview);requestAnimationFrame(fitPublicInvoice);});

  function invoicePayload(){
    const d=state.draft,c=R.calc(d);
    return {id:d.id||undefined,number:d.number,status:d.status||'draft',invoice_date:d.date,due_date:d.due,currency:d.currency,customer_id:d.customerId||null,customer_snapshot:{name:d.customerName||'',phone:d.customerPhone||'',email:d.customerEmail||'',address:d.customerAddress||''},items:d.items,discount:Number(d.discount)||0,tax:Number(d.tax)||0,shipping:Number(d.shipping)||0,payment_info:d.paymentInfo||'',notes:d.notes||'',template_id:d.templateId||state.selectedTemplate.id,subtotal:c.subtotal,total:c.total,public_enabled:d.publicEnabled!==false};
  }
  async function saveCurrentInvoice(quiet=false){
    if(!state.draft)return null;
    if(state.autosaveBusy)return null;
    state.autosaveBusy=true;setCloudBusy(true);$('#autosaveState').textContent='Menyimpan...';
    try{
      const row=await Cloud.saveInvoice(invoicePayload());
      state.draft.id=row.id;state.draft.publicToken=row.public_token;state.draft.status=row.status;state.draft.payments=row.payments||state.draft.payments||[];
      persistLocalDraft();
      const index=state.invoices.findIndex(x=>x.id===row.id);
      if(index>=0) state.invoices[index]={...state.invoices[index],...row,payments:state.invoices[index].payments||[]}; else state.invoices.unshift({...row,payments:[]});
      $('#editorTitle').textContent=row.number;
      $('#autosaveState').textContent='Tersimpan di cloud';
      renderDashboard();renderInvoices();
      if(!quiet)toast('Invoice tersimpan di cloud.');
      return row;
    }catch(err){ $('#autosaveState').textContent='Gagal sinkron'; if(!quiet)toast(err.message||'Gagal menyimpan invoice','error'); console.error(err); return null; }
    finally{state.autosaveBusy=false;setCloudBusy(false);}
  }
  $('#saveInvoiceBtn')?.addEventListener('click',()=>saveCurrentInvoice(false));
  $('#mobileSaveBtn')?.addEventListener('click',()=>saveCurrentInvoice(false));

  async function openInvoice(id){
    try{
      const row=await Cloud.getInvoice(id);
      state.draft={id:row.id,publicToken:row.public_token,number:row.number,status:row.status,date:row.invoice_date,due:row.due_date,currency:row.currency,customerId:row.customer_id||'',customerName:row.customer_snapshot?.name||'',customerPhone:row.customer_snapshot?.phone||'',customerEmail:row.customer_snapshot?.email||'',customerAddress:row.customer_snapshot?.address||'',items:row.items||[],discount:Number(row.discount)||0,tax:Number(row.tax)||0,shipping:Number(row.shipping)||0,paymentInfo:row.payment_info||'',notes:row.notes||'',templateId:row.template_id||'0-0',publicEnabled:row.public_enabled!==false,payments:row.payments||[]};
      state.undo=[];state.redo=[];selectTemplateInternal(state.draft.templateId,false);syncDraftToForm();renderInvoice();renderPaymentSummary();persistLocalDraft();$('#editorTitle').textContent=row.number;$('#autosaveState').textContent='Tersimpan di cloud';switchTab('editor');
    }catch(err){toast(err.message,'error');}
  }

  async function duplicateCurrent(){
    if(!state.draft)return;
    const old=clone(state.draft); const number=await Cloud.claimInvoiceNumber(todayPlus(0));
    state.draft={...old,id:null,publicToken:null,number,status:'draft',date:todayPlus(0),due:todayPlus(state.profile.defaultDueDays||7),payments:[]};syncDraftToForm();renderInvoice();persistLocalDraft();$('#editorTitle').textContent='Duplikat invoice';toast('Duplikat dibuat. Simpan saat siap.');
  }
  $('#duplicateBtn')?.addEventListener('click',duplicateCurrent);

  function renderPaymentSummary(){
    const el=$('#paymentSummary'); if(!state.draft?.id){el.classList.add('hidden');return;}
    const inv=state.invoices.find(x=>x.id===state.draft.id)||{total:R.calc(state.draft).total,payments:state.draft.payments||[]};
    const paid=invoicePaid(inv),left=Math.max(0,(Number(inv.total)||R.calc(state.draft).total)-paid);
    el.classList.remove('hidden');el.innerHTML=`<b>Pembayaran tercatat: ${money(paid,state.draft.currency)}</b><span>Sisa: ${money(left,state.draft.currency)} · ${escape(STATUS[state.draft.status]||state.draft.status)}</span>`;
  }

  // ---------------- Sharing / export ----------------
  async function ensureSavedForShare(){
    if(!state.draft.id){const row=await saveCurrentInvoice(true);if(!row)throw new Error('Invoice belum tersimpan.');}
    if(!state.draft.publicEnabled){state.draft.publicEnabled=true;$('#publicEnabled').checked=true;}
    if(state.draft.status==='draft'){state.draft.status='sent';$('#invoiceStatus').value='sent';}
    const row=await saveCurrentInvoice(true); return row||{public_token:state.draft.publicToken};
  }
  async function shareCurrent(){
    try{
      const row=await ensureSavedForShare(); const token=row.public_token||state.draft.publicToken; const link=publicLink(token);
      const text=`Halo ${state.draft.customerName||''}, berikut invoice ${state.draft.number} sebesar ${money(R.calc(state.draft).total,state.draft.currency)}. Invoice dapat dilihat di ${link}`;
      const phone=normalizePhone(state.draft.customerPhone);
      if(phone){ window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener'); toast('WhatsApp dibuka dengan pesan invoice.'); }
      else if(navigator.share){ await navigator.share({title:state.draft.number,text,url:link}); }
      else{ await navigator.clipboard.writeText(link); toast('Link invoice disalin.'); }
      renderInvoices();
    }catch(err){toast(err.message||'Gagal membagikan invoice','error');}
  }
  $('#shareInvoiceBtn')?.addEventListener('click',shareCurrent);$('#mobileShareBtn')?.addEventListener('click',shareCurrent);

  const EXPORT_LIBS={html2canvas:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',jspdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'};
  const scriptPromises=new Map();
  function loadScript(src,key){
    if(key==='html2canvas'&&window.html2canvas)return Promise.resolve(); if(key==='jspdf'&&window.jspdf?.jsPDF)return Promise.resolve(); if(scriptPromises.has(key))return scriptPromises.get(key);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error(`Gagal memuat ${key}`));document.head.appendChild(s);});scriptPromises.set(key,p);return p;
  }
  async function captureInvoice(){
    await loadScript(EXPORT_LIBS.html2canvas,'html2canvas');
    const paper=$('#invoicePaper'),canvasWrap=$('#paperCanvas'),prev=canvasWrap.style.transform;canvasWrap.style.transform='none';await new Promise(requestAnimationFrame);
    try{return await window.html2canvas(paper,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,width:794,height:1123,windowWidth:794,windowHeight:1123});}
    finally{canvasWrap.style.transform=prev;requestAnimationFrame(fitInvoicePreview);}
  }
  async function downloadPNG(){try{toast('Menyiapkan PNG...');const canvas=await captureInvoice();const a=document.createElement('a');a.download=`${state.draft.number||'invoice'}.png`;a.href=canvas.toDataURL('image/png',1);a.click();toast('PNG selesai.');}catch(err){toast(err.message||'Gagal membuat PNG','error');}}
  async function downloadPDF(){try{toast('Menyiapkan PDF...');await loadScript(EXPORT_LIBS.jspdf,'jspdf');const canvas=await captureInvoice();const img=canvas.toDataURL('image/jpeg',.97);const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});pdf.addImage(img,'JPEG',0,0,210,297,undefined,'FAST');pdf.save(`${state.draft.number||'invoice'}.pdf`);toast('PDF selesai.');}catch(err){toast(err.message||'Gagal membuat PDF','error');}}
  $('#downloadPngBtn')?.addEventListener('click',downloadPNG);$('#downloadPdfBtn')?.addEventListener('click',downloadPDF);$('#mobilePngBtn')?.addEventListener('click',downloadPNG);$('#mobilePdfBtn')?.addEventListener('click',downloadPDF);

  // ---------------- Invoice list / dashboard ----------------
  function renderDashboard(){
    const list=state.invoices||[];const now=new Date();const month=now.getMonth(),year=now.getFullYear();const baseCurrency=state.profile?.defaultCurrency||'IDR';const baseList=list.filter(i=>i.currency===baseCurrency);
    const monthInvoices=baseList.filter(i=>{const d=new Date(`${i.invoice_date}T00:00:00`);return d.getMonth()===month&&d.getFullYear()===year;});
    const billed=monthInvoices.filter(i=>i.status!=='cancelled').reduce((sum,i)=>sum+(Number(i.total)||0),0);
    const paid=monthInvoices.reduce((sum,i)=>sum+invoicePaid(i),0);
    const outstanding=baseList.filter(i=>!['paid','cancelled'].includes(i.status)).reduce((sum,i)=>sum+remaining(i),0);
    const overdue=baseList.filter(i=>i.status==='overdue').reduce((sum,i)=>sum+remaining(i),0);
    const cards=[['Tertagih bulan ini',money(billed,baseCurrency),`${monthInvoices.length} invoice · ${baseCurrency}`],['Pembayaran bulan ini',money(paid,baseCurrency),billed?`${Math.round((paid/billed)*100)}% dari tagihan`:'Belum ada pembayaran'],['Belum dibayar',money(outstanding,baseCurrency),`${baseList.filter(i=>!['paid','cancelled'].includes(i.status)).length} invoice · ${baseCurrency}`],['Jatuh tempo',money(overdue,baseCurrency),`${baseList.filter(i=>i.status==='overdue').length} invoice · ${baseCurrency}`]];
    $('#metricGrid').classList.remove('skeleton-grid');$('#metricGrid').innerHTML=cards.map(c=>`<article class="metric-card"><small>${c[0]}</small><b>${c[1]}</b><span>${c[2]}</span></article>`).join('');
    $('#dashboardGreeting').textContent=state.profile?.name?`Ringkasan ${state.profile.name}`:'Ringkasan bisnis';
    $('#invoiceNavCount').textContent=list.length;
    renderRevenueChart();
    const due=list.filter(i=>!['paid','cancelled'].includes(i.status)).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,5);
    $('#dueList').innerHTML=due.length?due.map(i=>`<div class="compact-row" data-open-invoice="${i.id}"><i class="due-dot"></i><div><b>${escape(i.number)} · ${escape(i.customer_snapshot?.name||'Tanpa pelanggan')}</b><span>${formatDate(i.due_date)} · sisa ${money(remaining(i),i.currency)}</span></div><span class="status-pill ${statusClass(i.status)}">${STATUS[i.status]||i.status}</span></div>`).join(''):'<div class="empty-state"><b>Tidak ada tagihan mendesak</b><span>Semua aman untuk saat ini.</span></div>';
    $('#recentInvoices').innerHTML=list.length?list.slice(0,6).map(invoiceRowHtml).join(''):'<div class="empty-state"><b>Belum ada invoice</b><span>Buat invoice pertama Anda.</span></div>';
  }
  function renderRevenueChart(){
    const months=[];const now=new Date();
    for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('id-ID',{month:'short'}),value:0});}
    const baseCurrency=state.profile?.defaultCurrency||'IDR';state.invoices.filter(inv=>inv.currency===baseCurrency).forEach(inv=>{const payments=inv.payments||[];if(payments.length){payments.forEach(p=>{const k=String(p.paid_at||'').slice(0,7);const m=months.find(x=>x.key===k);if(m)m.value+=Number(p.amount)||0;});}else if(inv.status==='paid'){const k=String(inv.paid_at||inv.updated_at||inv.invoice_date||'').slice(0,7);const m=months.find(x=>x.key===k);if(m)m.value+=Number(inv.total)||0;}});
    const max=Math.max(1,...months.map(m=>m.value));const total=months.reduce((s,m)=>s+m.value,0);$('#chartTotal').textContent=`Total ${money(total,state.profile?.defaultCurrency||'IDR')}`;
    $('#revenueChart').innerHTML=months.map(m=>`<div class="revenue-col" title="${m.label}: ${money(m.value,state.profile?.defaultCurrency||'IDR')}"><i class="revenue-bar" style="height:${Math.max(3,(m.value/max)*100)}%"></i><small>${m.label}</small></div>`).join('');
  }
  function invoiceRowHtml(i){
    return `<div class="invoice-row" data-invoice-row="${i.id}"><div class="invoice-main"><b>${escape(i.number)}</b><span>${escape(i.customer_snapshot?.name||'Tanpa pelanggan')} · ${formatDate(i.invoice_date)}</span></div><div class="invoice-cell"><b>${money(i.total,i.currency)}</b><span>Total</span></div><div class="invoice-cell hide-mid"><b>${money(invoicePaid(i),i.currency)}</b><span>Dibayar</span></div><div><span class="status-pill ${statusClass(i.status)}">${STATUS[i.status]||i.status}</span></div><div class="row-actions"><button class="kebab" data-open-invoice="${i.id}" title="Buka">↗</button><button class="kebab" data-pay-invoice="${i.id}" title="Pembayaran">$</button><button class="kebab" data-share-invoice="${i.id}" title="Kirim">⌁</button><button class="kebab" data-delete-invoice="${i.id}" title="Hapus">×</button></div></div>`;
  }
  function renderInvoices(){
    const q=($('#invoiceSearch')?.value||'').toLowerCase(),filter=$('#invoiceFilter')?.value||'all';
    const list=state.invoices.filter(i=>(filter==='all'||i.status===filter)&&(!q||`${i.number} ${i.customer_snapshot?.name||''}`.toLowerCase().includes(q)));
    $('#invoiceList').innerHTML=list.length?list.map(invoiceRowHtml).join(''):'<div class="empty-state"><b>Tidak ada invoice yang cocok</b><span>Ubah pencarian atau buat invoice baru.</span></div>';
    $('#invoiceNavCount').textContent=state.invoices.length;
  }
  $('#invoiceSearch')?.addEventListener('input',renderInvoices);$('#invoiceFilter')?.addEventListener('change',renderInvoices);
  document.addEventListener('click',async e=>{
    const open=e.target.closest('[data-open-invoice]'); if(open){openInvoice(open.dataset.openInvoice);return;}
    const pay=e.target.closest('[data-pay-invoice]'); if(pay){openPayment(pay.dataset.payInvoice);return;}
    const share=e.target.closest('[data-share-invoice]'); if(share){await shareInvoiceById(share.dataset.shareInvoice);return;}
    const del=e.target.closest('[data-delete-invoice]'); if(del&&confirm('Hapus invoice ini secara permanen?')){try{await Cloud.deleteInvoice(del.dataset.deleteInvoice);state.invoices=state.invoices.filter(x=>x.id!==del.dataset.deleteInvoice);renderDashboard();renderInvoices();toast('Invoice dihapus.');}catch(err){toast(err.message,'error');}return;}
  });
  function openPayment(id){
    const inv=state.invoices.find(x=>x.id===id);if(!inv)return;
    $('#paymentInvoiceId').value=id;$('#paymentAmount').value=Math.round(remaining(inv));$('#paymentNote').value='';openModal('paymentModal');
  }
  $('#paymentForm')?.addEventListener('submit',async e=>{
    e.preventDefault();try{const id=$('#paymentInvoiceId').value;await Cloud.addPayment(id,Number($('#paymentAmount').value),$('#paymentMethod').value,$('#paymentNote').value.trim());closeModal('paymentModal');state.invoices=await Cloud.listInvoices();renderDashboard();renderInvoices();if(state.draft?.id===id){const x=await Cloud.getInvoice(id);state.draft.status=x.status;state.draft.payments=x.payments||[];$('#invoiceStatus').value=x.status;renderPaymentSummary();}toast('Pembayaran tercatat.');}catch(err){toast(err.message,'error');}
  });
  async function shareInvoiceById(id){await openInvoice(id);await shareCurrent();}

  // ---------------- Customers ----------------
  function refreshCustomerSelects(){
    const opts=state.customers.map(c=>`<option value="${c.id}">${escape(c.name)}${c.phone?` · ${escape(c.phone)}`:''}</option>`).join('');
    $('#customerSelect').innerHTML='<option value="">— Isi manual —</option>'+opts;
    $('#recurringCustomer').innerHTML='<option value="">Pilih pelanggan</option>'+opts;
    if(state.draft)$('#customerSelect').value=state.draft.customerId||'';
  }
  function renderCustomers(){
    const q=($('#customerSearch')?.value||'').toLowerCase();const list=state.customers.filter(c=>!q||`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
    $('#customerGrid').innerHTML=list.length?list.map(c=>`<article class="data-card"><div class="data-title"><h3>${escape(c.name)}</h3><button class="kebab" data-edit-customer="${c.id}">•••</button></div><p>${escape(c.address||'Alamat belum diisi')}</p><div class="data-meta">${c.phone?`<span>${escape(c.phone)}</span>`:''}${c.email?`<span>${escape(c.email)}</span>`:''}</div><footer><button class="small-btn" data-use-customer="${c.id}">Buat invoice</button><button class="small-btn" data-delete-customer="${c.id}">Hapus</button></footer></article>`).join(''):'<div class="empty-state"><b>Belum ada pelanggan</b><span>Simpan pelanggan agar pembuatan invoice berikutnya lebih cepat.</span></div>';
    refreshCustomerSelects();
  }
  function openCustomerForm(id=''){
    const c=state.customers.find(x=>x.id===id);$('#customerId').value=c?.id||'';$('#customerFormName').value=c?.name||'';$('#customerFormPhone').value=c?.phone||'';$('#customerFormEmail').value=c?.email||'';$('#customerFormTax').value=c?.tax_id||'';$('#customerFormAddress').value=c?.address||'';$('#customerFormNotes').value=c?.notes||'';$('#customerModalTitle').textContent=c?'Edit pelanggan':'Tambah pelanggan';openModal('customerModal');
  }
  $('#addCustomerBtn')?.addEventListener('click',()=>openCustomerForm());$('#quickAddCustomer')?.addEventListener('click',()=>openCustomerForm());$('#customerSearch')?.addEventListener('input',renderCustomers);
  $('#customerForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await Cloud.saveCustomer({id:$('#customerId').value||undefined,name:$('#customerFormName').value.trim(),phone:$('#customerFormPhone').value.trim(),email:$('#customerFormEmail').value.trim(),tax_id:$('#customerFormTax').value.trim(),address:$('#customerFormAddress').value.trim(),notes:$('#customerFormNotes').value.trim()});state.customers=await Cloud.listCustomers();renderCustomers();closeModal('customerModal');toast('Pelanggan tersimpan.');}catch(err){toast(err.message,'error');}});
  $('#customerGrid')?.addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-customer]');if(edit){openCustomerForm(edit.dataset.editCustomer);return;}
    const use=e.target.closest('[data-use-customer]');if(use){const c=state.customers.find(x=>x.id===use.dataset.useCustomer);await newInvoice(false);Object.assign(state.draft,{customerId:c.id,customerName:c.name,customerPhone:c.phone||'',customerEmail:c.email||'',customerAddress:c.address||''});syncDraftToForm();renderInvoice();switchTab('editor');return;}
    const del=e.target.closest('[data-delete-customer]');if(del&&confirm('Hapus pelanggan ini?')){try{await Cloud.deleteCustomer(del.dataset.deleteCustomer);state.customers=await Cloud.listCustomers();renderCustomers();toast('Pelanggan dihapus.');}catch(err){toast(err.message,'error');}}
  });

  // ---------------- Products ----------------
  function renderProducts(){
    const q=($('#productSearch')?.value||'').toLowerCase();const list=state.products.filter(p=>!q||`${p.name} ${p.sku} ${p.description}`.toLowerCase().includes(q));
    $('#productGrid').innerHTML=list.length?list.map(p=>`<article class="data-card"><div class="data-title"><h3>${escape(p.name)}</h3><button class="kebab" data-edit-product="${p.id}">•••</button></div><p>${escape(p.description||'Tanpa deskripsi')}</p><p class="price-big">${money(p.price,state.profile?.defaultCurrency||'IDR')}</p><div class="data-meta"><span>${escape(p.unit||'pcs')}</span>${p.sku?`<span>${escape(p.sku)}</span>`:''}</div><footer><button class="small-btn" data-add-product-to-invoice="${p.id}">Tambah ke invoice</button><button class="small-btn" data-delete-product="${p.id}">Hapus</button></footer></article>`).join(''):'<div class="empty-state"><b>Belum ada produk atau jasa</b><span>Simpan item yang sering ditagihkan.</span></div>';
    if(state.draft)renderItems();
  }
  function openProductForm(id=''){
    const p=state.products.find(x=>x.id===id);$('#productId').value=p?.id||'';$('#productFormName').value=p?.name||'';$('#productFormSku').value=p?.sku||'';$('#productFormUnit').value=p?.unit||'pcs';$('#productFormPrice').value=Number(p?.price)||0;$('#productFormDescription').value=p?.description||'';$('#productModalTitle').textContent=p?'Edit produk / jasa':'Tambah produk / jasa';openModal('productModal');
  }
  $('#addProductBtn')?.addEventListener('click',()=>openProductForm());$('#productSearch')?.addEventListener('input',renderProducts);
  $('#productForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await Cloud.saveProduct({id:$('#productId').value||undefined,name:$('#productFormName').value.trim(),sku:$('#productFormSku').value.trim(),unit:$('#productFormUnit').value.trim()||'pcs',price:Number($('#productFormPrice').value)||0,description:$('#productFormDescription').value.trim()});state.products=await Cloud.listProducts();renderProducts();closeModal('productModal');toast('Produk tersimpan.');}catch(err){toast(err.message,'error');}});
  $('#productGrid')?.addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-product]');if(edit){openProductForm(edit.dataset.editProduct);return;}
    const add=e.target.closest('[data-add-product-to-invoice]');if(add){const p=state.products.find(x=>x.id===add.dataset.addProductToInvoice);if(!state.draft)await newInvoice(false);pushUndo();state.draft.items.push({productId:p.id,name:p.name,description:p.description||'',qty:1,unit:p.unit||'pcs',price:Number(p.price)||0});renderItems();afterDraftChange();switchTab('editor');return;}
    const del=e.target.closest('[data-delete-product]');if(del&&confirm('Hapus produk / jasa ini?')){try{await Cloud.deleteProduct(del.dataset.deleteProduct);state.products=await Cloud.listProducts();renderProducts();toast('Produk dihapus.');}catch(err){toast(err.message,'error');}}
  });

  // ---------------- Templates & builder ----------------
  function preference(templateId){ return state.preferences.find(p=>p.template_id===templateId); }
  function combinedTemplates(){ return [...T.templates,...state.customTemplates.map(T.fromCustom)]; }
  function renderTemplates(preserve=false){
    if(!preserve)state.templateVisible=36;
    const search=($('#templateSearch')?.value||'').toLowerCase(),view=$('#templateView')?.value||'all';
    const cats=['Semua',...new Set(combinedTemplates().map(t=>t.category))];
    $('#filterChips').innerHTML=cats.map(c=>`<button class="chip ${state.activeTemplateFilter===c?'active':''}" data-template-filter="${escape(c)}">${escape(c)}</button>`).join('');
    let list=combinedTemplates().filter(t=>(state.activeTemplateFilter==='Semua'||t.category===state.activeTemplateFilter)&&(!search||`${t.name} ${t.category} ${t.layout.name}`.toLowerCase().includes(search)));
    if(view==='favorite')list=list.filter(t=>preference(t.id)?.favorite);
    if(view==='custom')list=list.filter(t=>t.custom);
    if(view==='recent')list=list.filter(t=>preference(t.id)?.last_used_at).sort((a,b)=>String(preference(b.id)?.last_used_at).localeCompare(String(preference(a.id)?.last_used_at)));
    const visible=list.slice(0,state.templateVisible);
    $('#templateGrid').innerHTML=visible.map(t=>`<article class="template-card ${state.selectedTemplate?.id===t.id?'selected':''}" data-template-id="${t.id}">${t.custom?'<span class="custom-badge">CUSTOM</span>':''}<button class="favorite-btn ${preference(t.id)?.favorite?'active':''}" data-favorite-template="${t.id}" title="Favorit">♥</button><div class="template-thumb">${T.miniPreviewHtml(t)}</div><div class="template-info"><strong>${escape(t.name)}</strong><span>${escape(t.layout.name)} · ${escape(t.category)}</span>${t.custom?`<button class="custom-template-delete" data-delete-custom-template="${t.dbId}" type="button">Hapus template</button>`:''}</div></article>`).join('');
    $('#loadMoreTemplates').classList.toggle('hidden',visible.length>=list.length);$('#loadMoreTemplates').textContent=`Tampilkan lebih banyak (${Math.min(36,Math.max(0,list.length-visible.length))})`;$('#templateCount').textContent=combinedTemplates().length;
  }
  function selectTemplateInternal(id,savePref=true){
    state.selectedTemplate=T.find(id,state.customTemplates); if(state.draft)state.draft.templateId=state.selectedTemplate.id; renderInvoice();renderTemplates(true);persistLocalDraft();
    if(savePref&&Cloud.user()) Cloud.saveTemplatePreference(state.selectedTemplate.id,{last_used_at:new Date().toISOString()}).then(p=>{const i=state.preferences.findIndex(x=>x.template_id===p.template_id);if(i>=0)state.preferences[i]=p;else state.preferences.push(p);}).catch(()=>{});
  }
  $('#templateSearch')?.addEventListener('input',()=>renderTemplates(false));$('#templateView')?.addEventListener('change',()=>renderTemplates(false));$('#loadMoreTemplates')?.addEventListener('click',()=>{state.templateVisible+=36;renderTemplates(true);});$('#changeTemplateBtn')?.addEventListener('click',()=>switchTab('templates'));
  $('#filterChips')?.addEventListener('click',e=>{const b=e.target.closest('[data-template-filter]');if(!b)return;state.activeTemplateFilter=b.dataset.templateFilter;renderTemplates(false);});
  $('#templateGrid')?.addEventListener('click',async e=>{
    const delCustom=e.target.closest('[data-delete-custom-template]');if(delCustom){e.stopPropagation();if(confirm('Hapus template custom ini?')){try{await Cloud.deleteCustomTemplate(delCustom.dataset.deleteCustomTemplate);state.customTemplates=await Cloud.listCustomTemplates();if(state.selectedTemplate?.dbId===delCustom.dataset.deleteCustomTemplate)selectTemplateInternal('0-0',false);renderTemplates(false);toast('Template custom dihapus.');}catch(err){toast(err.message,'error');}}return;}
    const fav=e.target.closest('[data-favorite-template]');if(fav){e.stopPropagation();const old=preference(fav.dataset.favoriteTemplate);try{const p=await Cloud.saveTemplatePreference(fav.dataset.favoriteTemplate,{favorite:!old?.favorite,last_used_at:old?.last_used_at||null});const i=state.preferences.findIndex(x=>x.template_id===p.template_id);if(i>=0)state.preferences[i]=p;else state.preferences.push(p);renderTemplates(true);}catch(err){toast(err.message,'error');}return;}
    const card=e.target.closest('[data-template-id]');if(card){pushUndo();selectTemplateInternal(card.dataset.templateId,true);afterDraftChange();switchTab('editor');toast(`Template ${state.selectedTemplate.name} dipilih.`);}
  });
  $('#openTemplateBuilder')?.addEventListener('click',()=>{ $('#builderLayout').innerHTML=T.layouts.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');updateBuilderPreview();openModal('templateBuilderModal'); });
  ['builderLayout','builderAccent','builderSoft','builderName'].forEach(id=>$(`#${id}`)?.addEventListener('input',updateBuilderPreview));
  function updateBuilderPreview(){
    const t={id:'builder',name:$('#builderName')?.value||'Custom Template',category:'Custom',palette:{accent:$('#builderAccent')?.value||'#111827',soft:$('#builderSoft')?.value||'#f3f4f6'},layout:T.layouts.find(l=>l.id===($('#builderLayout')?.value||'classic'))||T.layouts[0]};
    if($('#builderPreview'))$('#builderPreview').innerHTML=T.miniPreviewHtml(t);
  }
  $('#templateBuilderForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await Cloud.saveCustomTemplate({name:$('#builderName').value.trim(),category:$('#builderCategory').value.trim()||'Custom',settings:{layout:$('#builderLayout').value,accent:$('#builderAccent').value,soft:$('#builderSoft').value}});state.customTemplates=await Cloud.listCustomTemplates();renderTemplates(false);closeModal('templateBuilderModal');toast('Template custom tersimpan.');}catch(err){toast(err.message,'error');}});

  // ---------------- Recurring ----------------
  function renderRecurring(){
    $('#recurringList').innerHTML=state.recurring.length?state.recurring.map(r=>`<article class="data-card"><div class="data-title"><h3>${escape(r.name)}</h3><span class="status-pill ${r.active?'status-paid':'status-draft'}">${r.active?'Aktif':'Nonaktif'}</span></div><p>${escape(r.customers?.name||'Pelanggan dihapus')} · setiap ${r.interval_months} bulan</p><div class="data-meta"><span>Berikutnya ${formatDate(r.next_run)}</span><span>Jatuh tempo +${r.due_days} hari</span></div><footer><button class="small-btn" data-toggle-recurring="${r.id}">${r.active?'Nonaktifkan':'Aktifkan'}</button><button class="small-btn" data-delete-recurring="${r.id}">Hapus</button></footer></article>`).join(''):'<div class="empty-state"><b>Belum ada recurring invoice</b><span>Buat aturan untuk tagihan yang berulang setiap bulan atau beberapa bulan.</span></div>';
  }
  $('#addRecurringBtn')?.addEventListener('click',()=>{
    if(!state.draft){toast('Buat invoice contoh terlebih dahulu.');return;} if(!state.customers.length){toast('Tambahkan pelanggan terlebih dahulu.');switchTab('customers');return;}
    refreshCustomerSelects();$('#recurringCustomer').value=state.draft.customerId||'';$('#recurringName').value=`${state.draft.customerName||'Pelanggan'} - Bulanan`;$('#recurringStart').value=todayPlus(0);$('#recurringDueDays').value=state.profile?.defaultDueDays||7;openModal('recurringModal');
  });
  $('#recurringForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const start=$('#recurringStart').value;await Cloud.saveRecurring({name:$('#recurringName').value.trim(),customer_id:$('#recurringCustomer').value,template_id:state.draft.templateId,currency:state.draft.currency,items:state.draft.items,discount:state.draft.discount,tax:state.draft.tax,shipping:state.draft.shipping,payment_info:state.draft.paymentInfo,notes:state.draft.notes,interval_months:Number($('#recurringInterval').value)||1,due_days:Number($('#recurringDueDays').value)||7,start_date:start,next_run:start,end_date:$('#recurringEnd').value||null,active:true});state.recurring=await Cloud.listRecurring();renderRecurring();closeModal('recurringModal');toast('Recurring invoice aktif.');}catch(err){toast(err.message,'error');}});
  $('#recurringList')?.addEventListener('click',async e=>{
    const toggle=e.target.closest('[data-toggle-recurring]');if(toggle){const r=state.recurring.find(x=>x.id===toggle.dataset.toggleRecurring);try{await Cloud.saveRecurring({...r,active:!r.active});state.recurring=await Cloud.listRecurring();renderRecurring();}catch(err){toast(err.message,'error');}return;}
    const del=e.target.closest('[data-delete-recurring]');if(del&&confirm('Hapus aturan recurring ini?')){try{await Cloud.deleteRecurring(del.dataset.deleteRecurring);state.recurring=await Cloud.listRecurring();renderRecurring();}catch(err){toast(err.message,'error');}}
  });

  // ---------------- Notifications ----------------
  function renderNotifications(){
    const unread=state.notifications.filter(n=>!n.read_at).length;$('#reminderBadge').textContent=unread;$('#reminderBadge').classList.toggle('hidden',!unread);
    $('#notificationList').innerHTML=state.notifications.length?state.notifications.map(n=>`<article class="notification-card ${n.read_at?'':'unread'}"><div class="notification-icon">${n.type==='overdue'?'!':'◷'}</div><div class="notification-body"><b>${escape(n.title)}</b><p>${escape(n.body)}</p><small>${new Date(n.created_at).toLocaleString('id-ID')}</small></div><div class="notification-actions">${n.invoices?`<button class="small-btn" data-open-invoice="${n.invoice_id}">Buka</button><button class="small-btn" data-remind-wa="${n.invoice_id}">WhatsApp</button>`:''}${!n.read_at?`<button class="small-btn" data-read-notification="${n.id}">Dibaca</button>`:''}</div></article>`).join(''):'<div class="empty-state"><b>Tidak ada reminder</b><span>Invoice yang mendekati atau melewati jatuh tempo akan muncul di sini.</span></div>';
  }
  $('#notificationList')?.addEventListener('click',async e=>{
    const read=e.target.closest('[data-read-notification]');if(read){await Cloud.markNotification(read.dataset.readNotification);const n=state.notifications.find(x=>x.id===read.dataset.readNotification);if(n)n.read_at=new Date().toISOString();renderNotifications();return;}
    const wa=e.target.closest('[data-remind-wa]');if(wa){const i=state.invoices.find(x=>x.id===wa.dataset.remindWa)||await Cloud.getInvoice(wa.dataset.remindWa);const phone=normalizePhone(i.customer_snapshot?.phone||'');const link=publicLink(i.public_token);const text=`Halo ${i.customer_snapshot?.name||''}, kami mengingatkan invoice ${i.number} sebesar ${money(i.total,i.currency)} yang jatuh tempo ${formatDate(i.due_date)}. Detail: ${link}`;if(phone)window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');else{await navigator.clipboard.writeText(text);toast('Pesan reminder disalin karena nomor pelanggan kosong.');}}
  });
  $('#markAllRead')?.addEventListener('click',async()=>{try{await Cloud.markAllNotifications();state.notifications.forEach(n=>n.read_at=n.read_at||new Date().toISOString());renderNotifications();}catch(err){toast(err.message,'error');}});
  $('#enableNotifications')?.addEventListener('click',async()=>{
    if(!('Notification'in window)){toast('Browser ini tidak mendukung notifikasi.');return;}
    const permission=await Notification.requestPermission();if(permission==='granted'){toast('Notifikasi browser diaktifkan.');showBrowserReminders();}else toast('Izin notifikasi tidak diberikan.');
  });
  async function showBrowserReminders(){
    if(Notification.permission!=='granted')return;const unread=state.notifications.filter(n=>!n.read_at).slice(0,3);if(!unread.length)return;
    const reg=await navigator.serviceWorker?.ready.catch(()=>null);unread.forEach(n=>{if(reg)reg.showNotification(n.title,{body:n.body,icon:'assets/icon-192.png',badge:'assets/icon-192.png'});else new Notification(n.title,{body:n.body});});
  }

  // ---------------- Settings ----------------
  function loadSettings(){
    const p=state.profile;if(!p)return;$('#settingsName').value=p.name;$('#settingsPhone').value=p.phone;$('#settingsAddress').value=p.address;$('#settingsEmail').value=p.email;$('#settingsWebsite').value=p.website;$('#settingsBankName').value=p.bankName;$('#settingsBankAccount').value=p.bankAccount;$('#settingsBankHolder').value=p.bankHolder;$('#settingsEwallet').value=p.ewallet;$('#invoicePattern').value=p.invoicePattern;$('#defaultCurrency').value=p.defaultCurrency;$('#defaultDueDays').value=p.defaultDueDays;setImagePreview('#settingsLogoPreview',p.logo,'LOGO');setImagePreview('#settingsSignaturePreview',p.signature,'TTD');setImagePreview('#settingsQrisPreview',p.qris,'QRIS');$('#accountInfo').innerHTML=`<b>${escape(Cloud.user()?.email||'Akun Supabase')}</b><span>User ID: ${escape(Cloud.user()?.id||'')}</span>`;
  }
  function setImagePreview(sel,url,label){const el=$(sel);if(!el)return;el.innerHTML=url?`<img src="${escape(url)}" alt="${label}">`:label;}
  $('#settingsForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.submitter;btn.disabled=true;
    try{
      const p={...state.profile,name:$('#settingsName').value.trim(),phone:$('#settingsPhone').value.trim(),address:$('#settingsAddress').value.trim(),email:$('#settingsEmail').value.trim(),website:$('#settingsWebsite').value.trim(),bankName:$('#settingsBankName').value.trim(),bankAccount:$('#settingsBankAccount').value.trim(),bankHolder:$('#settingsBankHolder').value.trim(),ewallet:$('#settingsEwallet').value.trim()};
      if($('#settingsLogo').files[0])p.logo=await Cloud.uploadAsset($('#settingsLogo').files[0],'logo');if($('#settingsSignature').files[0])p.signature=await Cloud.uploadAsset($('#settingsSignature').files[0],'signature');if($('#settingsQris').files[0])p.qris=await Cloud.uploadAsset($('#settingsQris').files[0],'qris');
      state.profile=profileToUi(await Cloud.saveProfile(profileToDb(p)));loadSettings();renderInvoice();toast('Profil bisnis diperbarui.');
    }catch(err){toast(err.message,'error');}finally{btn.disabled=false;}
  });
  $('#numberingForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const p={...state.profile,invoicePattern:$('#invoicePattern').value.trim()||'INV/{YYYY}/{MM}/{SEQ4}',defaultCurrency:$('#defaultCurrency').value,defaultDueDays:Number($('#defaultDueDays').value)||7};state.profile=profileToUi(await Cloud.saveProfile(profileToDb(p)));loadSettings();toast('Format invoice disimpan.');}catch(err){toast(err.message,'error');}});
  $('#exportDataBtn')?.addEventListener('click',()=>{const payload={profile:state.profile,customers:state.customers,products:state.products,invoices:state.invoices,recurring:state.recurring,customTemplates:state.customTemplates,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`invoiceku-backup-${todayPlus(0)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);});

  // ---------------- Public invoice ----------------
  async function loadPublicInvoice(token){
    if(!Cloud.configured()){showOnly('setupRequired');return;}
    showOnly('publicInvoice');
    try{
      const data=await Cloud.getPublicInvoice(token);if(!data)throw new Error('Invoice tidak ditemukan atau link dinonaktifkan.');
      const p=data.business||{};const profile={name:p.name,phone:p.phone,address:p.address,email:p.email,website:p.website,logo:p.logo_url,signature:p.signature_url,qris:p.qris_url,bankName:p.bank_name,bankAccount:p.bank_account,bankHolder:p.bank_holder,ewallet:p.ewallet};
      const d={number:data.number,status:data.status,date:data.invoice_date,due:data.due_date,currency:data.currency,customerName:data.customer?.name||'',customerPhone:data.customer?.phone||'',customerEmail:data.customer?.email||'',customerAddress:data.customer?.address||'',items:data.items||[],discount:Number(data.discount)||0,tax:Number(data.tax)||0,shipping:Number(data.shipping)||0,paymentInfo:data.payment_info||'',notes:data.notes||''};
      const publicCustom=data.template_custom?[data.template_custom]:[];const template=T.find(data.template_id||'0-0',publicCustom);R.render($('#publicPaper'),profile,d,template);$('#publicInvoiceTitle').textContent=data.number;$('#publicStatus').textContent=STATUS[data.status]||data.status;$('#publicStatus').className=`status-pill ${statusClass(data.status)}`;$('#publicTotal').textContent=money(data.total,data.currency);$('#publicDue').textContent=`Jatuh tempo ${formatDate(data.due_date)} · Dibayar ${money(data.paid_amount,data.currency)}`;
      const bank=[p.bank_name,p.bank_account,p.bank_holder].filter(Boolean).join(' · ');$('#publicPaymentBox').innerHTML=`<b>Pembayaran</b><span>${escape(data.payment_info||bank||p.ewallet||'Hubungi penerbit invoice untuk informasi pembayaran.')}</span>${p.qris_url?`<img src="${escape(p.qris_url)}" alt="QRIS">`:''}`;
      const phone=normalizePhone(p.phone);$('#publicWhatsapp').onclick=()=>{if(phone)window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Halo, saya ingin mengonfirmasi invoice ${data.number}.`)}`,'_blank');else toast('Nomor WhatsApp usaha belum tersedia.');};$('#publicPrint').onclick=()=>window.print();requestAnimationFrame(fitPublicInvoice);
    }catch(err){$('#publicInvoiceTitle').textContent='Invoice tidak tersedia';$('#publicStatus').textContent='Tidak ditemukan';$('#publicPaper').innerHTML=`<div class="public-error"><h2>Link invoice tidak dapat dibuka.</h2><p>${escape(err.message)}</p></div>`;}
  }
  function fitPublicInvoice(){ if(innerWidth>760)return;const paper=$('#publicPaper'),wrap=paper?.parentElement;if(!paper||!wrap)return;const scale=Math.min(1,(wrap.clientWidth-16)/794);paper.style.transform=`scale(${scale})`;paper.style.transformOrigin='top left';wrap.style.height=`${1123*scale+16}px`; }

  // ---------------- Render all ----------------
  function renderAllData(){ renderDashboard();renderInvoices();renderCustomers();renderProducts();renderTemplates(false);renderRecurring();renderNotifications();loadSettings();refreshCustomerSelects();showBrowserReminders().catch(()=>{}); }

  // ---------------- PWA / shortcuts ----------------
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e;$('#installBtn')?.classList.remove('hidden');});
  $('#installBtn')?.addEventListener('click',async()=>{if(!state.deferredPrompt)return;state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$('#installBtn').classList.add('hidden');});
  if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  addEventListener('keydown',e=>{
    if(!$('#app')||$('#app').classList.contains('hidden'))return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();saveCurrentInvoice(false);}
    if(mod&&e.key.toLowerCase()==='n'){e.preventDefault();newInvoice(true);}
    if(mod&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();downloadPDF();}
    if(mod&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();e.shiftKey?redo():undo();}
  });

  // ---------------- Boot ----------------
  async function boot(){
    const token=new URLSearchParams(location.search).get('invoice');
    if(token){await loadPublicInvoice(token);return;}
    if(!Cloud.configured()){showOnly('setupRequired');return;}
    try{
      const session=await Cloud.session();
      if(session)await bootstrapUser(); else showOnly('landing');
      Cloud.onAuthChange((event,s)=>{ if(event==='PASSWORD_RECOVERY'){openModal('passwordModal');return;} if(event==='SIGNED_IN'&&s?.user&&$('#app')?.classList.contains('hidden')&&$('#onboarding')?.classList.contains('hidden')) bootstrapUser(); if(event==='SIGNED_OUT'){resetState();showOnly('landing');} });
    }catch(err){console.error(err);showOnly('landing');toast('Supabase belum dapat dihubungi.','error');}
  }
  boot();
})();
