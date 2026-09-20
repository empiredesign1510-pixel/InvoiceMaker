(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const Cloud=window.InvoiceCloud, App=window.InvoiceKuApp, R=window.InvoiceRenderer, T=window.InvoiceTemplates;
  if(!Cloud||!App) return;
  const cache={businesses:[],quotes:[],receipts:[],proofs:[],activity:[],suiteView:'quotes',bulk:false,selected:new Set(),sheetLoaded:false};
  const escape=T.escape;
  const today=()=>new Date().toISOString().slice(0,10);
  const money=(v,c='IDR')=>App.money(v,c);
  const fmt=App.formatDate;
  const statusQuote={draft:'Draft',sent:'Terkirim',accepted:'Disetujui',rejected:'Ditolak',expired:'Kedaluwarsa',converted:'Jadi invoice'};
  const netErr=e=>/fetch|network|offline|failed to fetch/i.test(e?.message||'');

  function showError(err,label='Terjadi kesalahan'){console.error(err);App.toast(`${label}: ${err?.message||err}`,'error');}

  // ---------- Multi business ----------
  async function loadBusinesses(){
    if(!Cloud.user())return;
    try{
      cache.businesses=await Cloud.listBusinesses();
      const select=$('#businessSwitcher'); if(!select)return;
      if(!cache.businesses.length){select.innerHTML='<option>Bisnis utama</option>';return;}
      select.innerHTML=cache.businesses.map(b=>`<option value="${b.id}" ${b.id===Cloud.activeBusinessId()?'selected':''}>${escape(b.name||'Bisnis tanpa nama')}</option>`).join('');
      select.value=Cloud.activeBusinessId()||cache.businesses[0].id;
    }catch(err){console.warn('Multi-business belum aktif',err);}
  }
  $('#businessSwitcher')?.addEventListener('change',async e=>{Cloud.setActiveBusiness(e.target.value);App.toast('Beralih bisnis...');await App.reload();await loadBusinesses();await loadSuite();});
  $('#addBusinessQuick')?.addEventListener('click',()=>App.openModal('businessModal'));
  $('#businessForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const row=await Cloud.saveBusiness({name:$('#newBusinessName').value.trim(),phone:$('#newBusinessPhone').value.trim(),address:$('#newBusinessAddress').value.trim(),default_currency:App.state.profile?.defaultCurrency||'IDR',default_due_days:App.state.profile?.defaultDueDays||7});Cloud.setActiveBusiness(row.id);App.closeModal('businessModal');e.target.reset();await App.reload();await loadBusinesses();App.toast('Bisnis baru siap digunakan.');}catch(err){showError(err,'Gagal membuat bisnis');}finally{btn.disabled=false;}});

  // ---------- Quotations ----------
  function draftSnapshot(d){const c=R.calc(d);return {currency:d.currency,customer_id:d.customerId||null,customer_snapshot:{name:d.customerName||'',phone:d.customerPhone||'',email:d.customerEmail||'',address:d.customerAddress||''},items:d.items||[],discount:Number(d.discount)||0,tax:Number(d.tax)||0,tax_inclusive:Boolean(d.taxInclusive),shipping:Number(d.shipping)||0,notes:d.notes||'',template_id:d.templateId||'0-0',subtotal:c.subtotal,total:c.total};}
  async function saveCurrentAsQuote(){
    const d=App.state.draft;if(!d){App.toast('Buat isi dokumen terlebih dahulu.');return;}
    try{const number=await Cloud.claimQuoteNumber(today());const snap=draftSnapshot(d);await Cloud.saveQuote({...snap,number,status:'draft',quote_date:today(),valid_until:new Date(Date.now()+14*86400000).toISOString().slice(0,10),public_enabled:true});App.toast(`Penawaran ${number} dibuat.`);await loadSuite();App.switchTab('business');cache.suiteView='quotes';renderSuite();}catch(err){showError(err,'Gagal membuat penawaran');}
  }
  $('#saveAsQuoteBtn')?.addEventListener('click',saveCurrentAsQuote);
  $('#suiteNewQuote')?.addEventListener('click',async()=>{if(!App.state.draft)await App.newInvoice(false);App.switchTab('editor');App.toast('Isi dokumen lalu tekan “Penawaran”.');});
  async function convertQuote(id){
    const q=cache.quotes.find(x=>x.id===id);if(!q)return;
    try{const number=await Cloud.claimInvoiceNumber(today());const d=App.emptyDraft(number);Object.assign(d,{customerId:q.customer_id||'',customerName:q.customer_snapshot?.name||'',customerPhone:q.customer_snapshot?.phone||'',customerEmail:q.customer_snapshot?.email||'',customerAddress:q.customer_snapshot?.address||'',items:q.items||[],discount:Number(q.discount)||0,tax:Number(q.tax)||0,taxInclusive:Boolean(q.tax_inclusive),taxMode:(q.items||[]).some(x=>Number(x.taxRate))?'item':'invoice',shipping:Number(q.shipping)||0,notes:q.notes||'',templateId:q.template_id||'0-0',currency:q.currency||'IDR'});App.setDraft(d);App.switchTab('editor');await Cloud.saveQuote({...q,status:'converted'});App.toast('Penawaran dikonversi. Periksa lalu simpan invoice.');}catch(err){showError(err,'Gagal mengonversi');}
  }
  function openQuotePreview(id){const q=cache.quotes.find(x=>x.id===id);if(!q)return;const d={number:q.number,status:q.status,date:q.quote_date,due:q.valid_until,currency:q.currency,customerName:q.customer_snapshot?.name||'',customerPhone:q.customer_snapshot?.phone||'',customerEmail:q.customer_snapshot?.email||'',customerAddress:q.customer_snapshot?.address||'',items:q.items||[],discount:Number(q.discount)||0,tax:Number(q.tax)||0,taxInclusive:Boolean(q.tax_inclusive),taxMode:(q.items||[]).some(x=>Number(x.taxRate))?'item':'invoice',shipping:Number(q.shipping)||0,paymentInfo:'',notes:q.notes||'',documentType:'quote'};const template=T.find(q.template_id||'0-0',App.state.customTemplates);R.render($('#quotePreviewPaper'),App.state.profile,d,template);$('#quotePreviewModal').dataset.quoteId=id;App.openModal('quotePreviewModal');}

  $('#quotePrintBtn')?.addEventListener('click',()=>window.print());
  $('#quotePngBtn')?.addEventListener('click',async()=>{try{await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas');const canvas=await html2canvas($('#quotePreviewPaper'),{scale:2,backgroundColor:'#ffffff',useCORS:true,width:794,windowWidth:794});const a=document.createElement('a');a.download=`penawaran-${cache.quotes.find(x=>x.id===$('#quotePreviewModal').dataset.quoteId)?.number||Date.now()}.png`;a.href=canvas.toDataURL('image/png');a.click();}catch(err){showError(err,'Gagal membuat PNG');}});

  // ---------- Receipts ----------
  async function createReceipt(invoiceId){
    try{
      const inv=App.state.invoices.find(x=>x.id===invoiceId)||await Cloud.getInvoice(invoiceId);if(inv.status!=='paid'&&Number(inv.total)>0&&((inv.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0)<Number(inv.total)))throw new Error('Kwitansi tersedia setelah invoice lunas.');
      const existing=cache.receipts.find(r=>r.invoice_id===invoiceId);let receipt=existing;
      if(!receipt){const number=await Cloud.claimReceiptNumber(today());receipt=await Cloud.saveReceipt({invoice_id:invoiceId,number,receipt_date:today(),amount:Number(inv.total)||0,method:(inv.payments||[]).at(-1)?.method||'transfer',snapshot:{invoice_number:inv.number,customer:inv.customer_snapshot,currency:inv.currency,business:App.state.profile}});cache.receipts.unshift(receipt);}
      renderReceipt(receipt,inv);App.openModal('receiptModal');
    }catch(err){showError(err,'Gagal membuat kwitansi');}
  }
  function renderReceipt(r,inv){const p=App.state.profile||{},snap=r.snapshot||{},customer=snap.customer||inv?.customer_snapshot||{};$('#receiptPreview').innerHTML=`<div class="receipt-doc"><div class="receipt-brand"><div>${p.logo?`<img src="${escape(p.logo)}" alt="">`:''}<b>${escape(p.name||'Nama Usaha')}</b><small>${escape(p.address||'')}</small></div><strong>KWITANSI</strong></div><div class="receipt-number">${escape(r.number)}</div><div class="receipt-line"><span>Telah diterima dari</span><b>${escape(customer.name||'-')}</b></div><div class="receipt-line"><span>Sejumlah</span><b>${money(r.amount,snap.currency||inv?.currency||'IDR')}</b></div><div class="receipt-line"><span>Untuk pembayaran</span><b>Invoice ${escape(snap.invoice_number||inv?.number||'-')}</b></div><div class="receipt-line"><span>Metode</span><b>${escape(r.method||'transfer')}</b></div><div class="receipt-date">${fmt(r.receipt_date)}</div>${p.signature?`<img class="receipt-signature" src="${escape(p.signature)}" alt="Tanda tangan">`:''}<b>${escape(p.name||'')}</b></div>`;}
  $('#receiptPrintBtn')?.addEventListener('click',()=>window.print());
  $('#receiptPngBtn')?.addEventListener('click',async()=>{try{await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas');const el=$('.receipt-doc');const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});const a=document.createElement('a');a.download=`kwitansi-${Date.now()}.png`;a.href=canvas.toDataURL('image/png');a.click();App.toast('PNG kwitansi selesai.');}catch(err){showError(err,'Gagal membuat PNG');}});

  // ---------- Suite list ----------
  async function loadSuite(){
    if(!Cloud.user())return;
    const settled=await Promise.allSettled([Cloud.listQuotes(),Cloud.listReceipts(),Cloud.listPaymentProofs(),Cloud.listActivity()]);
    if(settled[0].status==='fulfilled')cache.quotes=settled[0].value;
    if(settled[1].status==='fulfilled')cache.receipts=settled[1].value;
    if(settled[2].status==='fulfilled')cache.proofs=settled[2].value;
    if(settled[3].status==='fulfilled')cache.activity=settled[3].value;
    renderSuite();
  }
  function renderSuite(){
    const el=$('#businessSuiteContent');if(!el)return;
    $$('[data-suite-view]').forEach(b=>b.classList.toggle('active',b.dataset.suiteView===cache.suiteView));
    if(cache.suiteView==='quotes')el.innerHTML=cache.quotes.length?cache.quotes.map(q=>`<article class="suite-row"><div><small>${fmt(q.quote_date)} · berlaku ${fmt(q.valid_until)}</small><b>${escape(q.number)}</b><span>${escape(q.customer_snapshot?.name||'Tanpa pelanggan')}</span></div><div><b>${money(q.total,q.currency)}</b><span class="status-pill status-${q.status==='accepted'?'paid':'draft'}">${statusQuote[q.status]||q.status}</span></div><div class="row-actions"><button class="small-btn" data-open-quote="${q.id}">Buka</button><button class="small-btn" data-quote-status="accepted" data-quote-id="${q.id}">Setujui</button><button class="small-btn" data-convert-quote="${q.id}">Jadi Invoice</button><button class="kebab" data-delete-quote="${q.id}">×</button></div></article>`).join(''):'<div class="empty-state"><b>Belum ada penawaran</b><span>Buat dari isi invoice editor agar item dan harga tidak perlu diketik ulang.</span></div>';
    if(cache.suiteView==='receipts')el.innerHTML=cache.receipts.length?cache.receipts.map(r=>`<article class="suite-row"><div><small>${fmt(r.receipt_date)}</small><b>${escape(r.number)}</b><span>${escape(r.invoices?.customer_snapshot?.name||'Pelanggan')}</span></div><div><b>${money(r.amount,r.invoices?.currency||'IDR')}</b><span>${escape(r.invoices?.number||'')}</span></div><button class="small-btn" data-open-receipt="${r.id}">Buka kwitansi</button></article>`).join(''):'<div class="empty-state"><b>Belum ada kwitansi</b><span>Pada invoice lunas tekan tombol ✓ untuk membuat kwitansi.</span></div>';
    if(cache.suiteView==='proofs')el.innerHTML=cache.proofs.length?cache.proofs.map(p=>`<article class="suite-row proof-row"><div><small>${new Date(p.submitted_at).toLocaleString('id-ID')}</small><b>${escape(p.invoices?.number||'Invoice')}</b><span>${escape(p.payer_name||p.invoices?.customer_snapshot?.name||'Pengirim')} · ${money(p.amount,p.invoices?.currency||'IDR')}</span></div><a href="${escape(p.file_url)}" target="_blank" rel="noopener">Lihat bukti</a><span class="status-pill status-${p.status==='accepted'?'paid':p.status==='rejected'?'cancelled':'draft'}">${escape(p.status)}</span>${p.status==='pending'?`<div class="row-actions"><button class="small-btn" data-proof-accept="${p.id}">Terima</button><button class="small-btn" data-proof-reject="${p.id}">Tolak</button></div>`:''}</article>`).join(''):'<div class="empty-state"><b>Belum ada bukti pembayaran</b><span>Pelanggan dapat mengirim bukti dari halaman invoice publik.</span></div>';
    if(cache.suiteView==='activity')el.innerHTML=cache.activity.length?`<div class="activity-timeline">${cache.activity.map(a=>`<article><i></i><div><b>${escape(a.title)}</b><span>${escape(a.invoices?.number||'')} · ${new Date(a.created_at).toLocaleString('id-ID')}</span></div></article>`).join('')}</div>`:'<div class="empty-state"><b>Belum ada aktivitas</b><span>Pembuatan invoice, perubahan status, pembayaran, dan invoice dibuka akan dicatat di sini.</span></div>';
  }
  $$('[data-suite-view]').forEach(b=>b.addEventListener('click',()=>{cache.suiteView=b.dataset.suiteView;renderSuite();}));
  $('#businessSuiteContent')?.addEventListener('click',async e=>{
    const oq=e.target.closest('[data-open-quote]');if(oq)return openQuotePreview(oq.dataset.openQuote);const cv=e.target.closest('[data-convert-quote]');if(cv)return convertQuote(cv.dataset.convertQuote);
    const qs=e.target.closest('[data-quote-status]');if(qs){const q=cache.quotes.find(x=>x.id===qs.dataset.quoteId);try{await Cloud.saveQuote({...q,status:qs.dataset.quoteStatus});await loadSuite();}catch(err){showError(err);}return;}
    const dq=e.target.closest('[data-delete-quote]');if(dq&&confirm('Hapus penawaran ini?')){try{await Cloud.deleteQuote(dq.dataset.deleteQuote);await loadSuite();}catch(err){showError(err);}return;}
    const rr=e.target.closest('[data-open-receipt]');if(rr){const r=cache.receipts.find(x=>x.id===rr.dataset.openReceipt),inv=App.state.invoices.find(x=>x.id===r?.invoice_id);if(r){renderReceipt(r,inv);App.openModal('receiptModal');}return;}
    const acc=e.target.closest('[data-proof-accept]');if(acc){try{const p=await Cloud.reviewPaymentProof(acc.dataset.proofAccept,'accepted');if(Number(p.amount)>0)await Cloud.addPayment(p.invoice_id,Number(p.amount),'transfer','Dari bukti pembayaran pelanggan');App.state.invoices=await Cloud.listInvoices();App.renderAllData();await loadSuite();App.toast('Bukti diterima dan pembayaran dicatat.');}catch(err){showError(err);}return;}
    const rej=e.target.closest('[data-proof-reject]');if(rej){try{await Cloud.reviewPaymentProof(rej.dataset.proofReject,'rejected');await loadSuite();}catch(err){showError(err);}}
  });

  // ---------- Invoice version history ----------
  document.addEventListener('click',async e=>{
    const h=e.target.closest('[data-history-invoice]');if(h){try{const versions=await Cloud.listInvoiceVersions(h.dataset.historyInvoice);$('#versionsList').innerHTML=versions.length?versions.map(v=>`<article class="version-row"><div><b>Versi ${v.version_no}</b><span>${new Date(v.created_at).toLocaleString('id-ID')}</span></div><button class="small-btn" data-restore-version="${v.id}" data-invoice-id="${h.dataset.historyInvoice}">Pulihkan</button><script type="application/json" id="version-${v.id}">${JSON.stringify(v.snapshot).replace(/<\//g,'<\\/')}</script></article>`).join(''):'<div class="empty-state"><b>Belum ada versi sebelumnya</b><span>Versi tercatat setelah invoice yang sudah tersimpan diedit.</span></div>';App.openModal('versionsModal');}catch(err){showError(err);}return;}
    const receipt=e.target.closest('[data-receipt-invoice]');if(receipt)return createReceipt(receipt.dataset.receiptInvoice);
  });
  $('#versionsList')?.addEventListener('click',async e=>{const b=e.target.closest('[data-restore-version]');if(!b)return;try{const raw=$(`#version-${b.dataset.restoreVersion}`)?.textContent;if(!raw)return;const r=JSON.parse(raw);const d=App.emptyDraft(r.number);Object.assign(d,{id:r.id,publicToken:r.public_token,number:r.number,status:r.status,date:r.invoice_date,due:r.due_date,currency:r.currency,customerId:r.customer_id||'',customerName:r.customer_snapshot?.name||'',customerPhone:r.customer_snapshot?.phone||'',customerEmail:r.customer_snapshot?.email||'',customerAddress:r.customer_snapshot?.address||'',items:r.items||[],discount:Number(r.discount)||0,tax:Number(r.tax)||0,taxInclusive:Boolean(r.tax_inclusive),taxMode:(r.items||[]).some(x=>Number(x.taxRate))?'item':'invoice',shipping:Number(r.shipping)||0,tags:r.tags||[],paymentInfo:r.payment_info||'',notes:r.notes||'',templateId:r.template_id||'0-0',publicEnabled:r.public_enabled!==false});App.setDraft(d);App.closeModal('versionsModal');App.switchTab('editor');App.toast('Versi lama dimuat. Tekan Simpan untuk menerapkan.');}catch(err){showError(err);}});

  // ---------- Smart import Excel / CSV ----------
  function loadScript(src,key){if(window[key])return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
  async function parseSpreadsheet(file){
    if(file.name.toLowerCase().endsWith('.csv')){const text=await file.text();const rows=text.split(/\r?\n/).filter(Boolean).map(line=>line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(x=>x.replace(/^\"|\"$/g,'').trim()));const headers=(rows.shift()||[]).map(h=>h.toLowerCase());return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));}
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{defval:''});
  }
  const pick=(row,names)=>{const map=Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).toLowerCase().replace(/[^a-z0-9]/g,''),v]));for(const n of names){const k=n.toLowerCase().replace(/[^a-z0-9]/g,'');if(map[k]!==undefined)return map[k];}return'';};
  async function importCustomers(file){const rows=await parseSpreadsheet(file),data=rows.map(r=>({name:String(pick(r,['name','nama','nama pelanggan'])).trim(),phone:String(pick(r,['phone','no hp','nomor hp','whatsapp','wa'])).trim(),email:String(pick(r,['email'])).trim(),address:String(pick(r,['address','alamat'])).trim(),tax_id:String(pick(r,['tax id','npwp'])).trim(),notes:String(pick(r,['notes','catatan'])).trim(),tags:String(pick(r,['tags','tag'])).split(',').map(x=>x.trim()).filter(Boolean)})).filter(r=>r.name);if(!data.length)throw new Error('Kolom nama pelanggan tidak ditemukan.');await Cloud.bulkSaveCustomers(data);await App.loadAllData();App.toast(`${data.length} pelanggan berhasil diimport.`);}
  async function importProducts(file){const rows=await parseSpreadsheet(file),data=rows.map(r=>({name:String(pick(r,['name','nama','produk','nama produk'])).trim(),sku:String(pick(r,['sku','kode'])).trim(),unit:String(pick(r,['unit','satuan'])).trim()||'pcs',price:Number(String(pick(r,['price','harga'])).replace(/[^0-9.-]/g,''))||0,description:String(pick(r,['description','deskripsi','keterangan'])).trim(),tags:String(pick(r,['tags','tag'])).split(',').map(x=>x.trim()).filter(Boolean)})).filter(r=>r.name);if(!data.length)throw new Error('Kolom nama produk tidak ditemukan.');await Cloud.bulkSaveProducts(data);await App.loadAllData();App.toast(`${data.length} produk berhasil diimport.`);}
  $('#importCustomersBtn')?.addEventListener('click',()=>$('#importCustomersFile').click());$('#importProductsBtn')?.addEventListener('click',()=>$('#importProductsFile').click());
  $('#importCustomersFile')?.addEventListener('change',async e=>{try{if(e.target.files[0])await importCustomers(e.target.files[0]);}catch(err){showError(err,'Import pelanggan gagal');}finally{e.target.value='';}});
  $('#importProductsFile')?.addEventListener('change',async e=>{try{if(e.target.files[0])await importProducts(e.target.files[0]);}catch(err){showError(err,'Import produk gagal');}finally{e.target.value='';}});

  // ---------- Bulk actions ----------
  function setBulk(on){cache.bulk=on;cache.selected.clear();$$('.bulk-check-wrap').forEach(x=>x.classList.toggle('hidden',!on));['bulkPaidBtn','bulkReminderBtn','bulkArchiveBtn','bulkDownloadBtn'].forEach(id=>$(`#${id}`)?.classList.toggle('hidden',!on));$('#bulkSelectToggle').textContent=on?'Selesai memilih':'Pilih banyak';}
  $('#bulkSelectToggle')?.addEventListener('click',()=>setBulk(!cache.bulk));
  $('#invoiceList')?.addEventListener('change',e=>{if(!e.target.classList.contains('bulk-invoice-check'))return;e.target.checked?cache.selected.add(e.target.value):cache.selected.delete(e.target.value);});
  async function refreshInvoices(){App.state.invoices=await Cloud.listInvoices();App.renderDashboard();App.renderInvoices();setTimeout(()=>setBulk(cache.bulk),0);}
  $('#bulkPaidBtn')?.addEventListener('click',async()=>{if(!cache.selected.size)return App.toast('Pilih invoice terlebih dahulu.');try{await Cloud.bulkInvoicePatch([...cache.selected],{status:'paid',paid_at:new Date().toISOString()});await refreshInvoices();App.toast('Invoice terpilih ditandai lunas.');}catch(err){showError(err);}});
  $('#bulkArchiveBtn')?.addEventListener('click',async()=>{if(!cache.selected.size)return App.toast('Pilih invoice terlebih dahulu.');try{await Cloud.bulkInvoicePatch([...cache.selected],{archived:true});await refreshInvoices();setBulk(false);App.toast('Invoice dipindahkan ke arsip.');}catch(err){showError(err);}});
  $('#bulkReminderBtn')?.addEventListener('click',async()=>{const list=App.state.invoices.filter(i=>cache.selected.has(i.id));if(!list.length)return App.toast('Pilih invoice terlebih dahulu.');const texts=list.map(i=>`• ${i.customer_snapshot?.name||'-'} — ${i.number} — ${money(i.total,i.currency)} — ${App.publicLink(i.public_token)}`);await navigator.clipboard.writeText(`Reminder InvoiceKu\n${texts.join('\n')}`);App.toast('Daftar reminder disalin. Kirim ke pelanggan melalui WhatsApp.');});
  $('#bulkDownloadBtn')?.addEventListener('click',async()=>{const ids=[...cache.selected];if(!ids.length)return App.toast('Pilih invoice terlebih dahulu.');App.toast(`Menyiapkan ${ids.length} PDF. Izinkan download berulang di browser.`);for(const id of ids){await App.openInvoice(id);await new Promise(r=>setTimeout(r,250));await App.downloadPDF();await new Promise(r=>setTimeout(r,350));}});

  // ---------- Command palette ----------
  function openCommand(){App.openModal('commandModal');setTimeout(()=>$('#commandSearch')?.focus(),60);renderCommands('');}
  $('#commandPaletteBtn')?.addEventListener('click',openCommand);
  function renderCommands(q=''){q=q.toLowerCase().trim();const actions=[{type:'action',title:'Buat invoice baru',sub:'Perintah',act:'new-invoice'},{type:'action',title:'Buat penawaran dari editor',sub:'Perintah',act:'new-quote'},{type:'action',title:'Tambah pelanggan',sub:'Perintah',act:'customer'}];const inv=App.state.invoices.filter(i=>!q||`${i.number} ${i.customer_snapshot?.name||''}`.toLowerCase().includes(q)).slice(0,8).map(i=>({type:'invoice',title:i.number,sub:i.customer_snapshot?.name||'Invoice',id:i.id}));const cust=App.state.customers.filter(c=>!q||`${c.name} ${c.phone}`.toLowerCase().includes(q)).slice(0,6).map(c=>({type:'customer',title:c.name,sub:c.phone||'Pelanggan',id:c.id}));const prod=App.state.products.filter(p=>!q||`${p.name} ${p.sku}`.toLowerCase().includes(q)).slice(0,6).map(p=>({type:'product',title:p.name,sub:money(p.price,App.state.profile?.defaultCurrency||'IDR'),id:p.id}));const all=[...actions.filter(x=>!q||x.title.toLowerCase().includes(q)),...inv,...cust,...prod];$('#commandResults').innerHTML=all.map(x=>`<button data-command-type="${x.type}" data-command-id="${x.id||''}" data-command-act="${x.act||''}"><b>${escape(x.title)}</b><span>${escape(x.sub)}</span></button>`).join('')||'<div class="empty-state"><b>Tidak ditemukan</b><span>Coba kata kunci lain.</span></div>';}
  $('#commandSearch')?.addEventListener('input',e=>renderCommands(e.target.value));
  $('#commandResults')?.addEventListener('click',async e=>{const b=e.target.closest('[data-command-type]');if(!b)return;App.closeModal('commandModal');if(b.dataset.commandType==='invoice')return App.openInvoice(b.dataset.commandId);if(b.dataset.commandType==='customer'){const c=App.state.customers.find(x=>x.id===b.dataset.commandId);await App.newInvoice(false);Object.assign(App.state.draft,{customerId:c.id,customerName:c.name,customerPhone:c.phone||'',customerEmail:c.email||'',customerAddress:c.address||''});App.setDraft(App.state.draft);return App.switchTab('editor');}if(b.dataset.commandType==='product'){const p=App.state.products.find(x=>x.id===b.dataset.commandId);if(!App.state.draft)await App.newInvoice(false);App.state.draft.items.push({productId:p.id,name:p.name,description:p.description||'',qty:1,unit:p.unit||'pcs',price:Number(p.price)||0,discount:0,taxRate:0});App.setDraft(App.state.draft);return App.switchTab('editor');}if(b.dataset.commandAct==='new-invoice')return App.newInvoice(true);if(b.dataset.commandAct==='new-quote')return saveCurrentAsQuote();if(b.dataset.commandAct==='customer'){$('#addCustomerBtn')?.click();}});

  // ---------- Preview modes ----------
  $('#previewModesBtn')?.addEventListener('click',()=>App.openModal('previewModeModal'));
  $$('.preview-mode-grid [data-preview-mode]').forEach(b=>b.addEventListener('click',async()=>{App.closeModal('previewModeModal');if(b.dataset.previewMode==='pdf')return App.downloadPDF();if(!App.state.draft?.id){const saved=await App.saveCurrentInvoice(true);if(!saved)return;}const token=App.state.draft.publicToken;if(!token)return App.toast('Simpan invoice terlebih dahulu.');window.open(`${App.publicLink(token)}${b.dataset.previewMode==='mobile'?'#mobile':''}`,'_blank','noopener');}));

  // ---------- Reminder settings ----------
  $('#saveReminderSettings')?.addEventListener('click',async()=>{try{const offsets=$('#reminderOffsets').value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite);const p={...App.state.profile,reminderOffsets:offsets.length?offsets:[-3,0,1,3,7],reminderMessage:$('#reminderMessage').value.trim()};App.state.profile=App.profileToUi(await Cloud.saveProfile(App.profileToDb(p)));App.toast('Pengaturan reminder disimpan.');}catch(err){showError(err);}});

  // ---------- Backup restore ----------
  async function exportBackup(){
    try{const [businesses,quotes,receipts,proofs,activity]=await Promise.all([Cloud.listBusinesses(),Cloud.listQuotes(),Cloud.listReceipts(),Cloud.listPaymentProofs(),Cloud.listActivity(500)]);const payload={version:6,businesses,profile:App.state.profile,customers:App.state.customers,products:App.state.products,invoices:App.state.invoices,recurring:App.state.recurring,customTemplates:App.state.customTemplates,quotes,receipts,proofs,activity,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`invoiceku-backup-v6-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),600);App.toast('Backup lengkap selesai.');}catch(err){showError(err,'Backup gagal');}
  }
  $('#restoreDataBtn')?.addEventListener('click',()=>$('#restoreDataFile').click());
  $('#restoreDataFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const bundle=JSON.parse(await f.text());if(!confirm('Restore akan menambahkan data pelanggan/produk dari backup. Lanjutkan?'))return;const r=await Cloud.restoreBundle(bundle);await App.loadAllData();App.toast(`Restore selesai: ${r.invoices||0} invoice, ${r.customers||0} pelanggan, ${r.products||0} produk.`);}catch(err){showError(err,'Restore gagal');}finally{e.target.value='';}});

  // ---------- Offline queue / conflict recovery ----------
  const QUEUE='invoiceku_offline_queue_v6';
  function getQueue(){try{return JSON.parse(localStorage.getItem(QUEUE)||'[]')}catch{return[]}}
  function queueOffline(type,payload){const q=getQueue();q.push({id:crypto.randomUUID?.()||String(Date.now()),type,payload,queuedAt:new Date().toISOString()});localStorage.setItem(QUEUE,JSON.stringify(q));}
  async function flushQueue(){if(!navigator.onLine||!Cloud.user())return;const q=getQueue();if(!q.length)return;const left=[];let done=0;for(const job of q){try{if(job.type==='invoice'){const payload={...job.payload};if(!payload.id&&/^INV-\d/.test(payload.number||''))payload.number=await Cloud.claimInvoiceNumber(payload.invoice_date||today());await Cloud.saveInvoice(payload);}done++;}catch(err){left.push(job);if(!netErr(err))console.warn(err);}}localStorage.setItem(QUEUE,JSON.stringify(left));if(done){await App.loadAllData();App.toast(`${done} perubahan offline berhasil disinkronkan.`);}}
  addEventListener('online',flushQueue);setTimeout(flushQueue,2200);

  // ---------- Global production guards ----------
  addEventListener('unhandledrejection',e=>{console.error('Unhandled promise',e.reason);if(netErr(e.reason))App.toast('Koneksi sedang bermasalah. Data lokal tetap dipertahankan.','error');});
  addEventListener('error',e=>console.error('App error',e.error||e.message));

  // ---------- Dynamic hooks / initialization ----------
  document.addEventListener('click',e=>{if(e.target.closest('[data-tab="business"],[data-more-tab="business"]'))loadSuite();});
  async function init(){
    if(!Cloud.user())return;
    await loadBusinesses();
    await loadSuite();
    if(!$('#bulkDownloadBtn')){const b=document.createElement('button');b.id='bulkDownloadBtn';b.className='secondary-btn hidden';b.textContent='Download PDF';$('#bulkArchiveBtn')?.after(b);b.addEventListener('click',async()=>{const ids=[...cache.selected];if(!ids.length)return App.toast('Pilih invoice terlebih dahulu.');for(const id of ids){await App.openInvoice(id);await new Promise(r=>setTimeout(r,200));await App.downloadPDF();}});}
  }
  const observer=new MutationObserver(()=>{if(!$('#app')?.classList.contains('hidden')&&Cloud.user()){observer.disconnect();init().catch(console.warn);}});observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});
  if(Cloud.user())init().catch(console.warn);

  window.InvoiceKuSuite={loadSuite,render:renderSuite,queueOffline,flushQueue,openCommand,exportBackup,loadBusinesses};
})();
