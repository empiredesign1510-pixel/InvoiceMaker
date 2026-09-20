const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const STORAGE = { profile:'invoiceku_profile', draft:'invoiceku_draft', history:'invoiceku_history', template:'invoiceku_template' };

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
  {name:'Sky',accent:'#0284c7',soft:'#f0f9ff',category:'Modern'}
];
const layouts = [
  {id:'classic',name:'Classic',class:''},
  {id:'bold',name:'Bold Header',class:'layout-bold'},
  {id:'minimal',name:'Minimal',class:'layout-minimal'},
  {id:'card',name:'Card',class:'layout-card'},
  {id:'stripe',name:'Top Stripe',class:'layout-stripe'},
  {id:'corner',name:'Soft Corner',class:'layout-corner'},
  {id:'border',name:'Framed',class:'layout-border'},
  {id:'geometric',name:'Geometric',class:'layout-geometric'},
  {id:'center',name:'Centered',class:'layout-center'},
  {id:'modern',name:'Modern Tag',class:'layout-modern'},
  {id:'soft',name:'Soft Surface',class:'layout-soft'},
  {id:'executive',name:'Executive',class:'layout-executive'}
];
const templates = palettes.flatMap((p,pi)=>layouts.map((l,li)=>({id:`${pi}-${li}`,name:`${p.name} ${String(li+1).padStart(2,'0')}`,palette:p,layout:l,category:p.category})));
let selectedTemplate = templates.find(t=>t.id===localStorage.getItem(STORAGE.template)) || templates[0];
let profile = safeParse(localStorage.getItem(STORAGE.profile), null);
let draft = safeParse(localStorage.getItem(STORAGE.draft), null);
let history = safeParse(localStorage.getItem(STORAGE.history), []);
let deferredPrompt = null;

function safeParse(v,fallback){try{return v?JSON.parse(v):fallback}catch{return fallback}}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function formatMoney(v,currency='IDR') { return new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:currency==='IDR'?0:2}).format(Number(v)||0); }
function todayPlus(days=0){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fileToDataURL(file){return new Promise((res,rej)=>{if(!file)return res(null);if(file.size>3*1024*1024)return rej(new Error('Ukuran file maksimal 3 MB'));const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function setPreview(el,data,label){el.innerHTML=data?`<img src="${data}" alt="${label}"/>`:label}

async function setupUpload(input, preview, key){
  input.addEventListener('change', async()=>{try{const data=await fileToDataURL(input.files[0]);input.dataset.value=data||'';setPreview(preview,data,key==='logo'?'LOGO':'TTD')}catch(e){toast(e.message)}})
}
setupUpload($('#logoInput'),$('#logoPreview'),'logo'); setupUpload($('#signatureInput'),$('#signaturePreview'),'signature');

$('#profileForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  profile={name:$('#businessName').value.trim(),phone:$('#businessPhone').value.trim(),address:$('#businessAddress').value.trim(),email:$('#businessEmail').value.trim(),website:$('#businessWebsite').value.trim(),logo:$('#logoInput').dataset.value||'',signature:$('#signatureInput').dataset.value||''};
  localStorage.setItem(STORAGE.profile,JSON.stringify(profile)); startApp(); toast('Profil usaha tersimpan');
});

function defaultDraft(){return{number:`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,currency:'IDR',date:todayPlus(0),due:todayPlus(7),customerName:'',customerPhone:'',customerAddress:'',items:[{name:'Produk / Jasa',qty:1,price:100000}],discount:0,tax:0,shipping:0,paymentInfo:'',notes:'Terima kasih atas kepercayaan Anda.'}}
function startApp(){ $('#onboarding').classList.add('hidden');$('#app').classList.remove('hidden');draft=draft||defaultDraft();loadDraftToForm();renderTemplates();renderHistory();loadSettings();renderInvoice(); }
function showOnboarding(){ $('#app').classList.add('hidden');$('#onboarding').classList.remove('hidden'); }
if(profile) startApp(); else showOnboarding();

function bindValue(id,key,type='text'){const el=$(id);el.addEventListener('input',()=>{draft[key]=type==='number'?(Number(el.value)||0):el.value;persistDraft();renderInvoice()})}
['#invoiceNumber','#currency','#invoiceDate','#dueDate','#customerName','#customerPhone','#customerAddress','#paymentInfo','#notes'].forEach(id=>bindValue(id,{invoiceNumber:'number',currency:'currency',invoiceDate:'date',dueDate:'due',customerName:'customerName',customerPhone:'customerPhone',customerAddress:'customerAddress',paymentInfo:'paymentInfo',notes:'notes'}[id.slice(1)]||id.slice(1)));
bindValue('#discount','discount','number');bindValue('#tax','tax','number');bindValue('#shipping','shipping','number');

function loadDraftToForm(){
  $('#invoiceNumber').value=draft.number;$('#currency').value=draft.currency;$('#invoiceDate').value=draft.date;$('#dueDate').value=draft.due;$('#customerName').value=draft.customerName;$('#customerPhone').value=draft.customerPhone;$('#customerAddress').value=draft.customerAddress;$('#discount').value=draft.discount;$('#tax').value=draft.tax;$('#shipping').value=draft.shipping;$('#paymentInfo').value=draft.paymentInfo;$('#notes').value=draft.notes;renderItems();
}
function persistDraft(){localStorage.setItem(STORAGE.draft,JSON.stringify(draft))}
function renderItems(){
  $('#itemsList').innerHTML=draft.items.map((it,i)=>`<div class="item-row"><label><span>Nama item</span><input data-item="name" data-i="${i}" value="${escapeHtml(it.name)}"></label><label><span>Qty</span><input data-item="qty" data-i="${i}" type="number" min="1" value="${it.qty}"></label><label><span>Harga</span><input data-item="price" data-i="${i}" type="number" min="0" value="${it.price}"></label><button class="item-remove" data-remove="${i}" title="Hapus">×</button></div>`).join('');
  $$('[data-item]').forEach(el=>el.addEventListener('input',()=>{const i=Number(el.dataset.i);draft.items[i][el.dataset.item]=el.dataset.item==='name'?el.value:(Number(el.value)||0);persistDraft();renderInvoice()}));
  $$('[data-remove]').forEach(el=>el.addEventListener('click',()=>{if(draft.items.length===1)return toast('Minimal 1 item');draft.items.splice(Number(el.dataset.remove),1);persistDraft();renderItems();renderInvoice()}));
}
$('#addItemBtn').addEventListener('click',()=>{draft.items.push({name:'Item baru',qty:1,price:0});persistDraft();renderItems();renderInvoice()});
$('#newInvoiceBtn').addEventListener('click',()=>{draft=defaultDraft();persistDraft();loadDraftToForm();renderInvoice();toast('Invoice baru dibuat')});

function calc(){const subtotal=draft.items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);const disc=subtotal*(draft.discount/100);const after=subtotal-disc;const tax=after*(draft.tax/100);const total=after+tax+(Number(draft.shipping)||0);return{subtotal,disc,tax,total}}
function formatDate(v){if(!v)return '-';return new Date(v+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
function standardInvoiceHtml(){
  const c=calc(), p=selectedTemplate.palette; const items=draft.items.map((it)=>`<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${formatMoney(it.price,draft.currency)}</td><td>${formatMoney(it.qty*it.price,draft.currency)}</td></tr>`).join('');
  return `<div class="inv-wrap ${selectedTemplate.layout.class}"><div class="inv-brand"><div style="display:flex;gap:16px;align-items:center">${profile.logo?`<img class="inv-logo" src="${profile.logo}">`:''}<div class="inv-business"><h2>${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.address)}</p><p>${escapeHtml(profile.phone)}${profile.email?` · ${escapeHtml(profile.email)}`:''}</p></div></div><div><h1 class="inv-title">INVOICE</h1><div class="inv-meta"><p><b>${escapeHtml(draft.number)}</b></p><p>Tanggal: ${formatDate(draft.date)}</p><p>Jatuh tempo: ${formatDate(draft.due)}</p></div></div></div><div class="inv-divider"></div><div class="inv-bill-row"><div class="inv-customer"><div class="inv-label">DITAGIHKAN KEPADA</div><h3>${escapeHtml(draft.customerName||'Nama Pelanggan')}</h3><p>${escapeHtml(draft.customerAddress||'Alamat pelanggan')}</p><p>${escapeHtml(draft.customerPhone||'')}</p></div><div class="inv-customer" style="text-align:right"><div class="inv-label">DARI</div><h3>${escapeHtml(profile.name)}</h3><p>${escapeHtml(profile.phone)}</p></div></div><table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>HARGA</th><th>JUMLAH</th></tr></thead><tbody>${items}</tbody></table><div class="inv-summary"><div class="sum-row"><span>Subtotal</span><b>${formatMoney(c.subtotal,draft.currency)}</b></div>${draft.discount?`<div class="sum-row"><span>Diskon (${draft.discount}%)</span><b>- ${formatMoney(c.disc,draft.currency)}</b></div>`:''}${draft.tax?`<div class="sum-row"><span>Pajak (${draft.tax}%)</span><b>${formatMoney(c.tax,draft.currency)}</b></div>`:''}${draft.shipping?`<div class="sum-row"><span>Ongkir</span><b>${formatMoney(draft.shipping,draft.currency)}</b></div>`:''}<div class="sum-row total"><span>TOTAL</span><span>${formatMoney(c.total,draft.currency)}</span></div></div><div class="inv-bottom"><div><div class="inv-payment"><b>Informasi pembayaran</b><br>${escapeHtml(draft.paymentInfo||'Tambahkan rekening / instruksi pembayaran')}</div><div class="inv-note" style="margin-top:18px"><b>Catatan</b><br>${escapeHtml(draft.notes||'-')}</div></div>${profile.signature?`<div class="inv-signature"><img src="${profile.signature}"><div class="sign-line">${escapeHtml(profile.name)}</div></div>`:''}</div><div class="inv-footer">Invoice dibuat dengan InvoiceKu · ${escapeHtml(profile.website||profile.email||profile.phone)}</div></div>`;
}
function boldInvoiceHtml(){return `<div class="inv-wrap ${selectedTemplate.layout.class}"><div class="inv-brand"><div style="display:flex;gap:16px;align-items:center">${profile.logo?`<img class="inv-logo" src="${profile.logo}">`:''}<div class="inv-business"><h2>${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.address)}</p><p>${escapeHtml(profile.phone)}</p></div></div><div><h1 class="inv-title">INVOICE</h1><div class="inv-meta"><p><b>${escapeHtml(draft.number)}</b></p><p>${formatDate(draft.date)}</p></div></div></div><div class="inv-body">${standardInvoiceHtml().match(/<div class="inv-divider">[\s\S]*<div class="inv-footer">[\s\S]*?<\/div><\/div>$/)?.[0]?.replace('<div class="inv-divider"></div>','')||''}</div></div>`}
function sidebarInvoiceHtml(){
  const c=calc(),items=draft.items.map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${formatMoney(it.qty*it.price,draft.currency)}</td></tr>`).join('');
  return `<div class="inv-wrap layout-sidebar"><aside class="inv-side">${profile.logo?`<img class="inv-logo" src="${profile.logo}" style="background:white;padding:6px">`:''}<h2 style="margin-top:20px">${escapeHtml(profile.name)}</h2><p>${escapeHtml(profile.address)}</p><p>${escapeHtml(profile.phone)}</p><p>${escapeHtml(profile.email||'')}</p><h1 class="inv-title">INVOICE</h1><p><b>${escapeHtml(draft.number)}</b><br>${formatDate(draft.date)}<br>Due ${formatDate(draft.due)}</p></aside><main class="inv-main"><div class="inv-customer"><div class="inv-label">DITAGIHKAN KEPADA</div><h3>${escapeHtml(draft.customerName||'Nama Pelanggan')}</h3><p>${escapeHtml(draft.customerAddress||'Alamat pelanggan')}</p><p>${escapeHtml(draft.customerPhone||'')}</p></div><table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>JUMLAH</th></tr></thead><tbody>${items}</tbody></table><div class="inv-summary"><div class="sum-row"><span>Subtotal</span><b>${formatMoney(c.subtotal,draft.currency)}</b></div>${draft.discount?`<div class="sum-row"><span>Diskon</span><b>- ${formatMoney(c.disc,draft.currency)}</b></div>`:''}${draft.tax?`<div class="sum-row"><span>Pajak</span><b>${formatMoney(c.tax,draft.currency)}</b></div>`:''}<div class="sum-row total"><span>TOTAL</span><span>${formatMoney(c.total,draft.currency)}</span></div></div><div class="inv-bottom"><div><div class="inv-payment"><b>Pembayaran</b><br>${escapeHtml(draft.paymentInfo||'-')}</div><div class="inv-note" style="margin-top:18px"><b>Catatan</b><br>${escapeHtml(draft.notes||'-')}</div></div>${profile.signature?`<div class="inv-signature"><img src="${profile.signature}"><div class="sign-line">${escapeHtml(profile.name)}</div></div>`:''}</div><div class="inv-footer">Terima kasih telah berbisnis bersama kami.</div></main></div>`
}
function renderInvoice(){const paper=$('#invoicePaper');paper.style.setProperty('--tpl-accent',selectedTemplate.palette.accent);paper.style.setProperty('--tpl-soft',selectedTemplate.palette.soft);paper.className='invoice-paper';paper.innerHTML=selectedTemplate.layout.id==='sidebar'?sidebarInvoiceHtml():selectedTemplate.layout.id==='bold'?boldInvoiceHtml():standardInvoiceHtml();$('#currentTemplateName').textContent=selectedTemplate.name}

function renderTemplates(filter='Semua',search=''){
  const cats=['Semua',...new Set(templates.map(t=>t.category))];$('#filterChips').innerHTML=cats.map(c=>`<button class="chip ${filter===c?'active':''}" data-filter="${c}">${c}</button>`).join('');
  $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>renderTemplates(b.dataset.filter,$('#templateSearch').value.trim())));
  const list=templates.filter(t=>(filter==='Semua'||t.category===filter)&&t.name.toLowerCase().includes(search.toLowerCase()));
  $('#templateGrid').innerHTML=list.map(t=>`<article class="template-card ${t.id===selectedTemplate.id?'selected':''}" data-template="${t.id}"><div class="template-thumb"><div class="mini-invoice" style="--m-accent:${t.palette.accent};--m-soft:${t.palette.soft};${t.layout.id==='border'?`border:4px solid ${t.palette.accent}`:''}"><div class="mini-top"><div class="mini-logo"></div><div class="mini-title"></div></div><div class="mini-line md"></div><div class="mini-line sm"></div><div class="mini-accent"></div><div class="mini-table"><div class="mini-row"></div><div class="mini-row"></div><div class="mini-row"></div></div><div class="mini-total"></div></div></div><div class="template-info"><strong>${t.name}</strong><span>${t.layout.name} · ${t.category}</span></div></article>`).join('');
  $$('[data-template]').forEach(el=>el.addEventListener('click',()=>selectTemplate(el.dataset.template,true)));
}
function selectTemplate(id,goEditor=false){selectedTemplate=templates.find(t=>t.id===id)||templates[0];localStorage.setItem(STORAGE.template,id);renderInvoice();renderTemplates($('.chip.active')?.dataset.filter||'Semua',$('#templateSearch').value.trim());if(goEditor){switchTab('editor');toast(`Template ${selectedTemplate.name} dipilih`)}}
$('#templateSearch').addEventListener('input',()=>renderTemplates($('.chip.active')?.dataset.filter||'Semua',$('#templateSearch').value.trim()));
$('#changeTemplateBtn').addEventListener('click',()=>switchTab('templates'));

function switchTab(name){$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('.tab-panel').forEach(p=>p.classList.remove('active'));$(`#${name}Tab`).classList.add('active');$('.sidebar').classList.remove('open')}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
$('#menuBtn').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));

function saveHistory(){const c=calc();const rec={id:Date.now(),number:draft.number,date:draft.date,customer:draft.customerName||'Tanpa nama',total:c.total,currency:draft.currency,template:selectedTemplate.id,draft:JSON.parse(JSON.stringify(draft))};history.unshift(rec);history=history.slice(0,100);localStorage.setItem(STORAGE.history,JSON.stringify(history));renderHistory();toast('Invoice disimpan ke riwayat')}
$('#saveDraftBtn').addEventListener('click',saveHistory);
function renderHistory(){const el=$('#historyList');if(!history.length){el.innerHTML='<div class="history-card"><div><strong>Belum ada invoice tersimpan.</strong><p class="muted">Buat invoice lalu tekan tombol Simpan.</p></div></div>';return}el.innerHTML=history.map(r=>`<div class="history-card"><div class="history-main"><div class="history-icon">#</div><div><strong>${escapeHtml(r.number)} · ${escapeHtml(r.customer)}</strong><small>${formatDate(r.date)} · ${formatMoney(r.total,r.currency)}</small></div></div><div class="history-actions"><button class="small-btn" data-open-history="${r.id}">Buka</button><button class="small-btn" data-delete-history="${r.id}">Hapus</button></div></div>`).join('');$$('[data-open-history]').forEach(b=>b.addEventListener('click',()=>{const r=history.find(x=>x.id==b.dataset.openHistory);draft=JSON.parse(JSON.stringify(r.draft));selectTemplate(r.template);persistDraft();loadDraftToForm();renderInvoice();switchTab('editor');toast('Invoice dibuka')}));$$('[data-delete-history]').forEach(b=>b.addEventListener('click',()=>{history=history.filter(x=>x.id!=b.dataset.deleteHistory);localStorage.setItem(STORAGE.history,JSON.stringify(history));renderHistory()}))}

async function capture(){const paper=$('#invoicePaper');toast('Menyiapkan file...');return html2canvas(paper,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:794,windowHeight:1123})}
async function downloadPNG(){try{const canvas=await capture();const a=document.createElement('a');a.download=`${draft.number||'invoice'}.png`;a.href=canvas.toDataURL('image/png',1);a.click();toast('PNG berhasil dibuat')}catch(e){console.error(e);toast('Gagal membuat PNG')}}
async function downloadPDF(){try{const canvas=await capture();const img=canvas.toDataURL('image/jpeg',.97);const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});pdf.addImage(img,'JPEG',0,0,210,297,undefined,'FAST');pdf.save(`${draft.number||'invoice'}.pdf`);toast('PDF berhasil dibuat')}catch(e){console.error(e);toast('Gagal membuat PDF')}}
$('#downloadPngBtn').addEventListener('click',downloadPNG);$('#downloadPdfBtn').addEventListener('click',downloadPDF);$('#quickDownload').addEventListener('click',()=>$('#downloadModal').classList.remove('hidden'));$('#modalPng').addEventListener('click',()=>{$('#downloadModal').classList.add('hidden');downloadPNG()});$('#modalPdf').addEventListener('click',()=>{$('#downloadModal').classList.add('hidden');downloadPDF()});$$('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>$('#downloadModal').classList.add('hidden')));

function loadSettings(){if(!profile)return;$('#settingsName').value=profile.name;$('#settingsPhone').value=profile.phone;$('#settingsAddress').value=profile.address;$('#settingsEmail').value=profile.email||'';$('#settingsWebsite').value=profile.website||'';setPreview($('#settingsLogoPreview'),profile.logo,'LOGO');setPreview($('#settingsSignaturePreview'),profile.signature,'TTD');$('#settingsLogo').dataset.value='';$('#settingsSignature').dataset.value=''}
setupUpload($('#settingsLogo'),$('#settingsLogoPreview'),'logo');setupUpload($('#settingsSignature'),$('#settingsSignaturePreview'),'signature');
$('#settingsForm').addEventListener('submit',(e)=>{e.preventDefault();profile={...profile,name:$('#settingsName').value.trim(),phone:$('#settingsPhone').value.trim(),address:$('#settingsAddress').value.trim(),email:$('#settingsEmail').value.trim(),website:$('#settingsWebsite').value.trim(),logo:$('#settingsLogo').dataset.value||profile.logo,signature:$('#settingsSignature').dataset.value||profile.signature};localStorage.setItem(STORAGE.profile,JSON.stringify(profile));renderInvoice();toast('Profil usaha diperbarui')});
$('#logoutBtn').addEventListener('click',()=>{localStorage.removeItem(STORAGE.profile);profile=null;location.reload()});
$('#exportDataBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({profile,draft,history,template:selectedTemplate.id},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='invoiceku-backup.json';a.click();URL.revokeObjectURL(a.href)});

window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
