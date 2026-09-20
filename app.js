const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE = { profile:'invoiceku_profile', draft:'invoiceku_draft', history:'invoiceku_history', template:'invoiceku_template', theme:'invoiceku_theme' };

const palettes = [
  {name:'Aurora',accent:'#2563eb',soft:'#eff6ff',category:'Modern'},
  {name:'Emerald',accent:'#059669',soft:'#ecfdf5',category:'Fresh'},
  {name:'Sunset',accent:'#ea580c',soft:'#fff7ed',category:'Warm'},
  {name:'Violet',accent:'#7c3aed',soft:'#f5f3ff',category:'Creative'},
  {name:'Rose',accent:'#e11d48',soft:'#fff1f2',category:'Elegant'},
  {name:'Ocean',accent:'#0891b2',soft:'#ecfeff',category:'Fresh'},
  {name:'Graphite',accent:'#334155',soft:'#f1f5f9',category:'Minimal'},
  {name:'Gold',accent:'#a16207',soft:'#fefce8',category:'Elegant'},
  {name:'Indigo',accent:'#4338ca',soft:'#eef2ff',category:'Corporate'},
  {name:'Teal',accent:'#0f766e',soft:'#f0fdfa',category:'Corporate'},
  {name:'Berry',accent:'#be185d',soft:'#fdf2f8',category:'Creative'},
  {name:'Sky',accent:'#0284c7',soft:'#f0f9ff',category:'Modern'},
  {name:'Cocoa',accent:'#7c4a32',soft:'#faf5f2',category:'Warm'},
  {name:'Lime',accent:'#4d7c0f',soft:'#f7fee7',category:'Fresh'},
  {name:'Plum',accent:'#86198f',soft:'#fdf4ff',category:'Creative'},
  {name:'Navy',accent:'#1e3a8a',soft:'#eff6ff',category:'Corporate'},
  {name:'Crimson',accent:'#991b1b',soft:'#fef2f2',category:'Elegant'},
  {name:'Slate',accent:'#1f2937',soft:'#f3f4f6',category:'Minimal'}
];

const layouts = [
  {id:'classic',name:'Classic',class:''},
  {id:'bold',name:'Bold Header',class:'layout-bold'},
  {id:'minimal',name:'Minimal',class:'layout-minimal'},
  {id:'card',name:'Soft Card',class:'layout-card'},
  {id:'stripe',name:'Top Stripe',class:'layout-stripe'},
  {id:'corner',name:'Soft Corner',class:'layout-corner'},
  {id:'border',name:'Framed',class:'layout-border'},
  {id:'geometric',name:'Geometric',class:'layout-geometric'},
  {id:'center',name:'Centered',class:'layout-center'},
  {id:'modern',name:'Modern Tag',class:'layout-modern'},
  {id:'soft',name:'Soft Surface',class:'layout-soft'},
  {id:'executive',name:'Executive',class:'layout-executive'},
  {id:'mono',name:'Monochrome',class:'layout-mono'},
  {id:'accentbar',name:'Accent Bar',class:'layout-accentbar'},
  {id:'darkhead',name:'Dark Header',class:'layout-darkhead'},
  {id:'elegant',name:'Elegant',class:'layout-elegant'}
];

const templates = palettes.flatMap((palette, pi) => layouts.map((layout, li) => ({
  id:`${pi}-${li}`,
  name:`${palette.name} ${layout.name}`,
  palette,
  layout,
  category:palette.category
})));

let selectedTemplate = templates.find(t => t.id === localStorage.getItem(STORAGE.template)) || templates[0];
let profile = safeParse(localStorage.getItem(STORAGE.profile), null);
let draft = safeParse(localStorage.getItem(STORAGE.draft), null);
let history = safeParse(localStorage.getItem(STORAGE.history), []);
let deferredPrompt = null;
let activeFilter = 'Semua';
let templateVisibleCount = 36;

const EXPORT_LIBS = {
  html2canvas:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
};
const scriptPromises = new Map();

function safeParse(value, fallback){ try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }

function loadScriptOnce(src, key){
  if(key==='html2canvas' && window.html2canvas) return Promise.resolve();
  if(key==='jspdf' && window.jspdf?.jsPDF) return Promise.resolve();
  if(scriptPromises.has(key)) return scriptPromises.get(key);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src; script.async=true; script.dataset.lib=key;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Gagal memuat library ${key}`));
    document.head.appendChild(script);
  });
  scriptPromises.set(key,promise);
  return promise;
}
async function ensureExportLibraries(needsPdf=false){
  await loadScriptOnce(EXPORT_LIBS.html2canvas,'html2canvas');
  if(needsPdf) await loadScriptOnce(EXPORT_LIBS.jspdf,'jspdf');
}
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2200); }
function formatMoney(value,currency='IDR'){ return new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:currency==='IDR'?0:2}).format(Number(value)||0); }
function todayPlus(days=0){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fileToDataURL(file){ return new Promise((resolve,reject)=>{ if(!file) return resolve(null); if(file.size>3*1024*1024) return reject(new Error('Ukuran file maksimal 3 MB')); const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }
function setPreview(el,data,label){ el.innerHTML=data?`<img src="${data}" alt="${label}"/>`:label; }

function preferredTheme(){
  const saved=localStorage.getItem(STORAGE.theme);
  if(saved==='light'||saved==='dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme, persist=false){
  const next=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=next;
  if(persist) localStorage.setItem(STORAGE.theme,next);
  const meta=$('#themeColorMeta');
  if(meta) meta.setAttribute('content',next==='dark'?'#0d0f10':'#f7f7f4');
  $$('[data-theme-toggle]').forEach(btn=>{
    btn.setAttribute('aria-pressed',String(next==='dark'));
    const label=btn.querySelector('.theme-label');
    if(label) label.textContent=next==='dark'?'Mode terang':'Mode gelap';
    btn.title=next==='dark'?'Gunakan mode terang':'Gunakan mode gelap';
  });
}
function toggleTheme(){
  applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true);
}
applyTheme(preferredTheme());
$$('[data-theme-toggle]').forEach(btn=>btn.addEventListener('click',toggleTheme));
if(window.matchMedia){
  const scheme=window.matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener?.('change',e=>{ if(!localStorage.getItem(STORAGE.theme)) applyTheme(e.matches?'dark':'light'); });
}

function setupUpload(input, preview, key){
  input.addEventListener('change', async()=>{ try { const data=await fileToDataURL(input.files[0]); input.dataset.value=data||''; setPreview(preview,data,key==='logo'?'LOGO':'TTD'); } catch(e){ toast(e.message); } });
}

setupUpload($('#logoInput'),$('#logoPreview'),'logo');
setupUpload($('#signatureInput'),$('#signaturePreview'),'signature');

function showLanding(){
  $('#landing').classList.remove('hidden');
  $('#onboarding').classList.add('hidden');
  $('#app').classList.add('hidden');
  window.scrollTo({top:0,behavior:'instant'});
}
function openFromLanding(target='editor'){
  if(profile){ startApp(target); }
  else { $('#landing').classList.add('hidden'); $('#onboarding').classList.remove('hidden'); window.scrollTo(0,0); }
}

['#landingCtaTop','#landingCta','#landingCtaBottom'].forEach(id=>$(id).addEventListener('click',()=>openFromLanding('editor')));
$('#showcaseCta').addEventListener('click',()=>openFromLanding('templates'));
$('#backToLanding').addEventListener('click',showLanding);
$('#backHomeBtn').addEventListener('click',showLanding);

$('#profileForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  profile={
    name:$('#businessName').value.trim(),
    phone:$('#businessPhone').value.trim(),
    address:$('#businessAddress').value.trim(),
    email:$('#businessEmail').value.trim(),
    website:$('#businessWebsite').value.trim(),
    logo:$('#logoInput').dataset.value||'',
    signature:$('#signatureInput').dataset.value||''
  };
  localStorage.setItem(STORAGE.profile,JSON.stringify(profile));
  startApp('editor');
  toast('Profil usaha tersimpan');
});

function defaultDraft(){
  return {
    number:`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    currency:'IDR', date:todayPlus(0), due:todayPlus(7),
    customerName:'', customerPhone:'', customerAddress:'',
    items:[{name:'Produk / Jasa',qty:1,price:100000}], discount:0, tax:0, shipping:0,
    paymentInfo:'', notes:'Terima kasih atas kepercayaan Anda.'
  };
}

function startApp(target='editor'){
  $('#landing').classList.add('hidden');
  $('#onboarding').classList.add('hidden');
  $('#app').classList.remove('hidden');
  draft=draft||defaultDraft();
  loadDraftToForm();
  renderTemplates();
  renderHistory();
  loadSettings();
  renderInvoice();
  switchTab(target);
  requestAnimationFrame(fitInvoicePreview);
  window.scrollTo(0,0);
}

showLanding();

const valueMap={
  invoiceNumber:'number',currency:'currency',invoiceDate:'date',dueDate:'due',customerName:'customerName',customerPhone:'customerPhone',customerAddress:'customerAddress',paymentInfo:'paymentInfo',notes:'notes'
};
function bindValue(id,key,type='text'){
  const el=$(id);
  el.addEventListener('input',()=>{ draft[key]=type==='number'?(Number(el.value)||0):el.value; persistDraft(); renderInvoice(); });
}
['#invoiceNumber','#currency','#invoiceDate','#dueDate','#customerName','#customerPhone','#customerAddress','#paymentInfo','#notes'].forEach(id=>bindValue(id,valueMap[id.slice(1)]||id.slice(1)));
bindValue('#discount','discount','number');
bindValue('#tax','tax','number');
bindValue('#shipping','shipping','number');

function loadDraftToForm(){
  $('#invoiceNumber').value=draft.number; $('#currency').value=draft.currency; $('#invoiceDate').value=draft.date; $('#dueDate').value=draft.due;
  $('#customerName').value=draft.customerName; $('#customerPhone').value=draft.customerPhone; $('#customerAddress').value=draft.customerAddress;
  $('#discount').value=draft.discount; $('#tax').value=draft.tax; $('#shipping').value=draft.shipping; $('#paymentInfo').value=draft.paymentInfo; $('#notes').value=draft.notes;
  renderItems();
}
function persistDraft(){ localStorage.setItem(STORAGE.draft,JSON.stringify(draft)); }
function renderItems(){
  $('#itemsList').innerHTML=draft.items.map((item,i)=>`<div class="item-row"><label><span>Nama item</span><input data-item="name" data-i="${i}" value="${escapeHtml(item.name)}"></label><label><span>Qty</span><input data-item="qty" data-i="${i}" type="number" min="1" value="${item.qty}"></label><label><span>Harga</span><input data-item="price" data-i="${i}" type="number" min="0" value="${item.price}"></label><button class="item-remove" data-remove="${i}" title="Hapus">×</button></div>`).join('');
  $$('[data-item]').forEach(el=>el.addEventListener('input',()=>{ const i=Number(el.dataset.i); draft.items[i][el.dataset.item]=el.dataset.item==='name'?el.value:(Number(el.value)||0); persistDraft(); renderInvoice(); }));
  $$('[data-remove]').forEach(el=>el.addEventListener('click',()=>{ if(draft.items.length===1) return toast('Minimal 1 item'); draft.items.splice(Number(el.dataset.remove),1); persistDraft(); renderItems(); renderInvoice(); }));
}
$('#addItemBtn').addEventListener('click',()=>{ draft.items.push({name:'Item baru',qty:1,price:0}); persistDraft(); renderItems(); renderInvoice(); });
$('#newInvoiceBtn').addEventListener('click',()=>{ draft=defaultDraft(); persistDraft(); loadDraftToForm(); renderInvoice(); toast('Invoice baru dibuat'); });

function calc(){ const subtotal=draft.items.reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.price)||0),0); const disc=subtotal*(draft.discount/100); const after=subtotal-disc; const tax=after*(draft.tax/100); const total=after+tax+(Number(draft.shipping)||0); return{subtotal,disc,tax,total}; }
function formatDate(value){ if(!value)return '-'; return new Date(value+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }

function invoiceRows(includePrice=true){
  return draft.items.map(item=>`<tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td>${includePrice?`<td>${formatMoney(item.price,draft.currency)}</td>`:''}<td>${formatMoney(item.qty*item.price,draft.currency)}</td></tr>`).join('');
}
function summaryHtml(){
  const c=calc();
  return `<div class="inv-summary"><div class="sum-row"><span>Subtotal</span><b>${formatMoney(c.subtotal,draft.currency)}</b></div>${draft.discount?`<div class="sum-row"><span>Diskon (${draft.discount}%)</span><b>- ${formatMoney(c.disc,draft.currency)}</b></div>`:''}${draft.tax?`<div class="sum-row"><span>Pajak (${draft.tax}%)</span><b>${formatMoney(c.tax,draft.currency)}</b></div>`:''}${draft.shipping?`<div class="sum-row"><span>Ongkir</span><b>${formatMoney(draft.shipping,draft.currency)}</b></div>`:''}<div class="sum-row total"><span>TOTAL</span><span>${formatMoney(c.total,draft.currency)}</span></div></div>`;
}
function bottomHtml(){
  return `<div class="inv-bottom"><div><div class="inv-payment"><b>Informasi pembayaran</b><br>${escapeHtml(draft.paymentInfo||'-')}</div><div class="inv-note" style="margin-top:18px"><b>Catatan</b><br>${escapeHtml(draft.notes||'-')}</div></div>${profile.signature?`<div class="inv-signature"><img src="${profile.signature}"><div class="sign-line">${escapeHtml(profile.name)}</div></div>`:''}</div><div class="inv-footer">Terima kasih telah berbisnis bersama kami.</div>`;
}
function standardInvoiceHtml(){
  return `<div class="inv-wrap ${selectedTemplate.layout.class}"><div class="inv-brand"><div style="display:flex;gap:16px;align-items:center">${profile.logo?`<img class="inv-logo" src="${profile.logo}">`:''}<div class="inv-business"><h2>${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.address)}</p><p>${escapeHtml(profile.phone)}${profile.email?` · ${escapeHtml(profile.email)}`:''}</p></div></div><div><h1 class="inv-title">INVOICE</h1><div class="inv-meta"><p><b>${escapeHtml(draft.number)}</b></p><p>Tanggal: ${formatDate(draft.date)}</p><p>Jatuh tempo: ${formatDate(draft.due)}</p></div></div></div><div class="inv-divider"></div><div class="inv-bill-row"><div class="inv-customer"><div class="inv-label">DITAGIHKAN KEPADA</div><h3>${escapeHtml(draft.customerName||'Nama Pelanggan')}</h3><p>${escapeHtml(draft.customerAddress||'Alamat pelanggan')}</p><p>${escapeHtml(draft.customerPhone||'')}</p></div><div class="inv-customer" style="text-align:right"><div class="inv-label">DARI</div><h3>${escapeHtml(profile.name)}</h3><p>${escapeHtml(profile.phone)}</p></div></div><table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>HARGA</th><th>JUMLAH</th></tr></thead><tbody>${invoiceRows(true)}</tbody></table>${summaryHtml()}${bottomHtml()}</div>`;
}
function boldInvoiceHtml(){
  const base=standardInvoiceHtml();
  const bodyStart=base.indexOf('<div class="inv-divider"></div>');
  const brandEnd=base.indexOf('<div class="inv-divider"></div>');
  const brand=base.slice(base.indexOf('<div class="inv-brand">'),brandEnd);
  const body=base.slice(bodyStart+'<div class="inv-divider"></div>'.length,base.lastIndexOf('</div>'));
  return `<div class="inv-wrap layout-bold">${brand}<div class="inv-body">${body}</div></div>`;
}
function sidebarInvoiceHtml(){
  return `<div class="inv-wrap layout-sidebar"><aside class="inv-side">${profile.logo?`<img class="inv-logo" src="${profile.logo}" style="background:white;padding:6px">`:''}<h2 style="margin-top:20px">${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.address)}</p><p>${escapeHtml(profile.phone)}</p><p>${escapeHtml(profile.email||'')}</p><h1 class="inv-title">INVOICE</h1><p><b>${escapeHtml(draft.number)}</b><br>${formatDate(draft.date)}<br>Due ${formatDate(draft.due)}</p></aside><main class="inv-main"><div class="inv-customer"><div class="inv-label">DITAGIHKAN KEPADA</div><h3>${escapeHtml(draft.customerName||'Nama Pelanggan')}</h3><p>${escapeHtml(draft.customerAddress||'Alamat pelanggan')}</p><p>${escapeHtml(draft.customerPhone||'')}</p></div><table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>JUMLAH</th></tr></thead><tbody>${invoiceRows(false)}</tbody></table>${summaryHtml()}${bottomHtml()}</main></div>`;
}
function renderInvoice(){
  if(!profile || !draft) return;
  const paper=$('#invoicePaper');
  paper.style.setProperty('--tpl-accent',selectedTemplate.palette.accent);
  paper.style.setProperty('--tpl-soft',selectedTemplate.palette.soft);
  paper.className='invoice-paper';
  paper.innerHTML=selectedTemplate.layout.id==='sidebar'?sidebarInvoiceHtml():selectedTemplate.layout.id==='bold'?boldInvoiceHtml():standardInvoiceHtml();
  $('#currentTemplateName').textContent=selectedTemplate.name;
  requestAnimationFrame(fitInvoicePreview);
}

function miniPreviewHtml(template){
  const p=template.palette, l=template.layout.id;
  const miniClass={bold:'mini-bold',sidebar:'mini-sidebar',minimal:'mini-minimal',card:'mini-card',stripe:'mini-stripe',corner:'mini-corner',border:'mini-border',geometric:'mini-geometric',center:'mini-center',modern:'mini-modern',soft:'mini-soft',executive:'mini-executive',mono:'mini-mono',accentbar:'mini-accentbar',darkhead:'mini-darkhead',elegant:'mini-elegant'}[l]||'';
  if(l==='sidebar'){
    return `<div class="real-mini-invoice ${miniClass}" style="--m-accent:${p.accent};--m-soft:${p.soft}"><aside class="mi-side"><div class="mi-logo"></div><b>STUDIO NUSA</b><span>Jakarta</span><span>0812 3456 7890</span><strong>INVOICE</strong><span>#INV-2048</span></aside><main class="mi-main"><div class="mi-client"><small>DITAGIHKAN KEPADA</small><b>Arunika Creative</b><span>Jakarta, Indonesia</span></div>${miniTable()}<div class="mi-total"><span>TOTAL</span><b>7,5 JT</b></div><div class="mi-foot">Terima kasih.</div></main></div>`;
  }
  const inner=`<div class="mi-brand"><div class="mi-brand-left"><div class="mi-logo"></div><div><div class="mi-business">STUDIO NUSA</div><div class="mi-contact">Jakarta · 0812 3456 7890</div></div></div><div><div class="mi-title">INVOICE</div><div class="mi-number">#INV-2048</div></div></div><div class="mi-rule"></div><div class="mi-client"><small>DITAGIHKAN KEPADA</small><b>Arunika Creative</b><span>Jakarta, Indonesia</span></div>${miniTable()}<div class="mi-total"><span>TOTAL</span><b>7,5 JT</b></div><div class="mi-foot">Pembayaran • BCA 123456789</div>`;
  return `<div class="real-mini-invoice ${miniClass}" style="--m-accent:${p.accent};--m-soft:${p.soft}">${l==='bold'?`<div class="mi-brand">${inner.match(/<div class="mi-brand">([\s\S]*?)<\/div><div class="mi-rule">/)[1]}</div><div class="mi-body"><div class="mi-client"><small>DITAGIHKAN KEPADA</small><b>Arunika Creative</b><span>Jakarta, Indonesia</span></div>${miniTable()}<div class="mi-total"><span>TOTAL</span><b>7,5 JT</b></div><div class="mi-foot">Pembayaran • BCA 123456789</div></div>`:inner}</div>`;
}
function miniTable(){
  return `<div class="mi-table"><div class="mi-table-head"><span>ITEM</span><span>QTY</span><span>JUMLAH</span></div><div class="mi-row"><span>Brand Identity</span><span>1</span><span>2,5 JT</span></div><div class="mi-row"><span>Social Media Kit</span><span>1</span><span>1,25 JT</span></div><div class="mi-row"><span>Website Landing</span><span>1</span><span>3,75 JT</span></div></div>`;
}

function renderLandingTemplates(){
  const picks=[templates[0],templates.find(t=>t.layout.id==='bold'&&t.palette.name==='Emerald'),templates.find(t=>t.layout.id==='elegant'&&t.palette.name==='Graphite')];
  $('#landingTemplateGrid').innerHTML=picks.map(t=>`<article class="landing-template"><div class="template-thumb">${miniPreviewHtml(t)}</div><div class="landing-template-meta"><b>${t.name}</b><span>${t.category}</span></div></article>`).join('');
}
renderLandingTemplates();
$('#heroTemplateCount').textContent=templates.length;
$('#templateCount').textContent=templates.length;

function renderTemplates(filter=activeFilter, search=$('#templateSearch').value.trim(), preserveCount=false){
  if(filter!==activeFilter || !preserveCount) templateVisibleCount=36;
  activeFilter=filter;
  const cats=['Semua',...new Set(templates.map(t=>t.category))];
  $('#filterChips').innerHTML=cats.map(c=>`<button class="chip ${filter===c?'active':''}" data-filter="${c}">${c}</button>`).join('');
  $$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>renderTemplates(btn.dataset.filter,$('#templateSearch').value.trim())));
  const q=search.toLowerCase();
  const list=templates.filter(t=>(filter==='Semua'||t.category===filter)&&(!q||`${t.name} ${t.layout.name} ${t.category}`.toLowerCase().includes(q)));
  const visible=list.slice(0,templateVisibleCount);
  $('#templateGrid').innerHTML=visible.map(t=>`<article class="template-card ${t.id===selectedTemplate.id?'selected':''}" data-template="${t.id}"><div class="template-thumb">${miniPreviewHtml(t)}</div><div class="template-info"><strong>${t.name}</strong><span>${t.layout.name} · ${t.category}</span></div></article>`).join('');
  $$('[data-template]').forEach(el=>el.addEventListener('click',()=>selectTemplate(el.dataset.template,true)));
  const more=$('#loadMoreTemplates');
  more.classList.toggle('hidden',visible.length>=list.length);
  more.textContent=`Tampilkan lebih banyak (${Math.min(36,list.length-visible.length)} berikutnya)`;
}

function selectTemplate(id,goEditor=false){
  selectedTemplate=templates.find(t=>t.id===id)||templates[0];
  localStorage.setItem(STORAGE.template,id);
  renderInvoice();
  renderTemplates();
  if(goEditor){ switchTab('editor'); toast(`Template ${selectedTemplate.name} dipilih`); }
}
$('#templateSearch').addEventListener('input',()=>renderTemplates(activeFilter,$('#templateSearch').value.trim()));
$('#loadMoreTemplates').addEventListener('click',()=>{ templateVisibleCount+=36; renderTemplates(activeFilter,$('#templateSearch').value.trim(),true); });
$('#changeTemplateBtn').addEventListener('click',()=>switchTab('templates'));

function switchTab(name){
  $$('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===name));
  $$('.mobile-nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileTab===name));
  $$('.tab-panel').forEach(panel=>panel.classList.remove('active'));
  const panel=$(`#${name}Tab`); if(panel) panel.classList.add('active');
  if(name==='editor') requestAnimationFrame(fitInvoicePreview);
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
$$('.mobile-nav-item').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.mobileTab)));

function fitInvoicePreview(){
  const stage=$('#paperStage'), canvas=$('#paperCanvas');
  if(!stage || !canvas || $('#app').classList.contains('hidden')) return;
  const available=Math.max(260,stage.clientWidth-20);
  const scale=Math.min(1,available/794);
  canvas.style.transform=`scale(${scale})`;
  canvas.style.height=`${1123*scale}px`;
  stage.style.minHeight=`${1123*scale+20}px`;
}
window.addEventListener('resize',()=>requestAnimationFrame(fitInvoicePreview));

function saveHistory(){
  const c=calc();
  const rec={id:Date.now(),number:draft.number,date:draft.date,customer:draft.customerName||'Tanpa nama',total:c.total,currency:draft.currency,template:selectedTemplate.id,draft:JSON.parse(JSON.stringify(draft))};
  history.unshift(rec); history=history.slice(0,100); localStorage.setItem(STORAGE.history,JSON.stringify(history)); renderHistory(); toast('Invoice disimpan ke riwayat');
}
$('#saveDraftBtn').addEventListener('click',saveHistory);
function renderHistory(){
  const el=$('#historyList');
  if(!history.length){ el.innerHTML='<div class="history-card"><div><strong>Belum ada invoice tersimpan.</strong><p class="muted">Buat invoice lalu tekan tombol Simpan.</p></div></div>'; return; }
  el.innerHTML=history.map(r=>`<div class="history-card"><div class="history-main"><div class="history-icon">#</div><div><strong>${escapeHtml(r.number)} · ${escapeHtml(r.customer)}</strong><small>${formatDate(r.date)} · ${formatMoney(r.total,r.currency)}</small></div></div><div class="history-actions"><button class="small-btn" data-open-history="${r.id}">Buka</button><button class="small-btn" data-delete-history="${r.id}">Hapus</button></div></div>`).join('');
  $$('[data-open-history]').forEach(btn=>btn.addEventListener('click',()=>{ const r=history.find(x=>x.id==btn.dataset.openHistory); draft=JSON.parse(JSON.stringify(r.draft)); selectTemplate(r.template); persistDraft(); loadDraftToForm(); renderInvoice(); switchTab('editor'); toast('Invoice dibuka'); }));
  $$('[data-delete-history]').forEach(btn=>btn.addEventListener('click',()=>{ history=history.filter(x=>x.id!=btn.dataset.deleteHistory); localStorage.setItem(STORAGE.history,JSON.stringify(history)); renderHistory(); }));
}

async function capture(){
  await ensureExportLibraries(false);
  const paper=$('#invoicePaper'), canvasWrap=$('#paperCanvas');
  toast('Menyiapkan file...');
  const previous=canvasWrap.style.transform;
  canvasWrap.style.transform='none';
  await new Promise(requestAnimationFrame);
  try { return await html2canvas(paper,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,width:794,height:1123,windowWidth:794,windowHeight:1123}); }
  finally { canvasWrap.style.transform=previous; requestAnimationFrame(fitInvoicePreview); }
}
async function downloadPNG(){ try { const canvas=await capture(); const a=document.createElement('a'); a.download=`${draft.number||'invoice'}.png`; a.href=canvas.toDataURL('image/png',1); a.click(); toast('PNG berhasil dibuat'); } catch(e){ console.error(e); toast('Gagal membuat PNG'); } }
async function downloadPDF(){ try { await ensureExportLibraries(true); const canvas=await capture(); const img=canvas.toDataURL('image/jpeg',.97); const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true}); pdf.addImage(img,'JPEG',0,0,210,297,undefined,'FAST'); pdf.save(`${draft.number||'invoice'}.pdf`); toast('PDF berhasil dibuat'); } catch(e){ console.error(e); toast('Gagal membuat PDF'); } }
$('#downloadPngBtn').addEventListener('click',downloadPNG);
$('#downloadPdfBtn').addEventListener('click',downloadPDF);
$('#mobilePngBtn').addEventListener('click',downloadPNG);
$('#mobilePdfBtn').addEventListener('click',downloadPDF);
$('#quickDownload').addEventListener('click',()=>$('#downloadModal').classList.remove('hidden'));
$('#modalPng').addEventListener('click',()=>{$('#downloadModal').classList.add('hidden');downloadPNG();});
$('#modalPdf').addEventListener('click',()=>{$('#downloadModal').classList.add('hidden');downloadPDF();});
$$('[data-close-modal]').forEach(btn=>btn.addEventListener('click',()=>$('#downloadModal').classList.add('hidden')));

function loadSettings(){
  if(!profile)return;
  $('#settingsName').value=profile.name; $('#settingsPhone').value=profile.phone; $('#settingsAddress').value=profile.address; $('#settingsEmail').value=profile.email||''; $('#settingsWebsite').value=profile.website||'';
  setPreview($('#settingsLogoPreview'),profile.logo,'LOGO'); setPreview($('#settingsSignaturePreview'),profile.signature,'TTD'); $('#settingsLogo').dataset.value=''; $('#settingsSignature').dataset.value='';
}
setupUpload($('#settingsLogo'),$('#settingsLogoPreview'),'logo');
setupUpload($('#settingsSignature'),$('#settingsSignaturePreview'),'signature');
$('#settingsForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  profile={...profile,name:$('#settingsName').value.trim(),phone:$('#settingsPhone').value.trim(),address:$('#settingsAddress').value.trim(),email:$('#settingsEmail').value.trim(),website:$('#settingsWebsite').value.trim(),logo:$('#settingsLogo').dataset.value||profile.logo,signature:$('#settingsSignature').dataset.value||profile.signature};
  localStorage.setItem(STORAGE.profile,JSON.stringify(profile)); renderInvoice(); toast('Profil usaha diperbarui');
});
$('#logoutBtn').addEventListener('click',()=>{ localStorage.removeItem(STORAGE.profile); localStorage.removeItem(STORAGE.draft); profile=null; draft=null; showLanding(); toast('Profil lokal telah dihapus'); });
$('#exportDataBtn').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify({profile,draft,history,template:selectedTemplate.id},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='invoiceku-backup.json'; a.click(); URL.revokeObjectURL(a.href); });

window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').addEventListener('click',async()=>{ if(!deferredPrompt)return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#installBtn').classList.add('hidden'); });
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
