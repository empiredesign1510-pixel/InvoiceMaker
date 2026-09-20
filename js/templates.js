(() => {
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

  const useCases = ['UMKM','Freelancer','Corporate','Creative','Restaurant','Contractor','Automotive','Education','Professional Service','Retail','Photography','Technology'];

  const templates = palettes.flatMap((palette, pi) => layouts.map((layout, li) => ({
    id:`${pi}-${li}`,
    name:`${palette.name} ${layout.name}`,
    palette,
    layout,
    category:useCases[(pi * layouts.length + li) % useCases.length],
    styleCategory:palette.category,
    custom:false
  })));

  const escape = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function fromCustom(row){
    const settings = row.settings || {};
    const layout = layouts.find(x => x.id === settings.layout) || layouts[0];
    return {
      id:`custom:${row.id}`,
      dbId:row.id,
      name:row.name,
      category:row.category || 'Custom',
      custom:true,
      palette:{name:'Custom',accent:settings.accent || '#111827',soft:settings.soft || '#f3f4f6',category:row.category || 'Custom'},
      layout,
      settings
    };
  }

  function miniTable(){
    return `<div class="mi-table"><div class="mi-table-head"><span>ITEM</span><span>QTY</span><span>JUMLAH</span></div><div class="mi-row"><span>Brand Identity</span><span>1</span><span>2,5 JT</span></div><div class="mi-row"><span>Social Media Kit</span><span>1</span><span>1,25 JT</span></div><div class="mi-row"><span>Website Landing</span><span>1</span><span>3,75 JT</span></div></div>`;
  }

  function miniPreviewHtml(template){
    const p = template.palette;
    const l = template.layout.id;
    const miniClass = {
      bold:'mini-bold',minimal:'mini-minimal',card:'mini-card',stripe:'mini-stripe',corner:'mini-corner',
      border:'mini-border',geometric:'mini-geometric',center:'mini-center',modern:'mini-modern',soft:'mini-soft',
      executive:'mini-executive',mono:'mini-mono',accentbar:'mini-accentbar',darkhead:'mini-darkhead',elegant:'mini-elegant'
    }[l] || '';
    const brand = `<div class="mi-brand"><div class="mi-brand-left"><div class="mi-logo"></div><div><div class="mi-business">STUDIO NUSA</div><div class="mi-contact">Jakarta · 0812 3456 7890</div></div></div><div><div class="mi-title">INVOICE</div><div class="mi-number">#INV-2048</div></div></div>`;
    const client = `<div class="mi-client"><small>DITAGIHKAN KEPADA</small><b>Arunika Creative</b><span>Jakarta, Indonesia</span></div>`;
    const total = `<div class="mi-total"><span>TOTAL</span><b>7,5 JT</b></div><div class="mi-foot">Pembayaran · BCA 123456789</div>`;
    if(l === 'bold') return `<div class="real-mini-invoice ${miniClass}" style="--m-accent:${p.accent};--m-soft:${p.soft}">${brand}<div class="mi-body">${client}${miniTable()}${total}</div></div>`;
    return `<div class="real-mini-invoice ${miniClass}" style="--m-accent:${p.accent};--m-soft:${p.soft}">${brand}<div class="mi-rule"></div>${client}${miniTable()}${total}</div>`;
  }

  function find(id, customRows=[]){
    if(String(id || '').startsWith('custom:')){
      const dbId = String(id).slice(7);
      const row = customRows.find(x => x.id === dbId);
      if(row) return fromCustom(row);
    }
    return templates.find(t => t.id === id) || templates[0];
  }

  window.InvoiceTemplates = { palettes, layouts, useCases, templates, fromCustom, find, miniPreviewHtml, escape };
})();
