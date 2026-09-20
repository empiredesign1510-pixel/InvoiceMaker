(() => {
  'use strict';
  const escape = window.InvoiceTemplates.escape;
  const nl = value => escape(value || '').replace(/\n/g,'<br>');
  const money = (value, currency='IDR') => new Intl.NumberFormat('id-ID',{style:'currency',currency,maximumFractionDigits:currency==='IDR'?0:2}).format(Number(value)||0);
  const date = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';

  function calc(draft){
    const taxMode=draft.taxMode||'invoice';
    const inclusive=Boolean(draft.taxInclusive);
    let gross=0,lineDiscount=0,lineTax=0,itemNet=0;
    const lines=(draft.items||[]).map(item=>{
      const base=(Number(item.qty)||0)*(Number(item.price)||0);gross+=base;
      const discount=base*(Number(item.discount)||0)/100;lineDiscount+=discount;
      const after=Math.max(0,base-discount);
      let tax=0,total=after;
      if(taxMode==='item'){
        const rate=Number(item.taxRate)||0;
        if(inclusive&&rate>0){tax=after-(after/(1+rate/100));total=after;}else{tax=after*rate/100;total=after+tax;}
        lineTax+=tax;
      }
      itemNet+=total;
      return {base,discount,tax,total};
    });
    const subtotal=taxMode==='item'?itemNet:Math.max(0,gross-lineDiscount);
    const invoiceDisc=subtotal*(Number(draft.discount)||0)/100;
    const after=Math.max(0,subtotal-invoiceDisc);
    let invoiceTax=0,total=after;
    if(taxMode!=='item'){
      const rate=Number(draft.tax)||0;
      if(inclusive&&rate>0){invoiceTax=after-(after/(1+rate/100));total=after;}else{invoiceTax=after*rate/100;total=after+invoiceTax;}
    }
    total+=(Number(draft.shipping)||0);
    return {gross,subtotal,lineDiscount,invoiceDiscount:invoiceDisc,disc:lineDiscount+invoiceDisc,tax:lineTax+invoiceTax,total,lines};
  }

  function itemRows(draft){
    const c=calc(draft);
    return (draft.items||[]).map((item,i)=>{
      const extras=[];
      if(Number(item.discount))extras.push(`Diskon ${Number(item.discount)}%`);
      if((draft.taxMode||'invoice')==='item'&&Number(item.taxRate))extras.push(`Pajak ${Number(item.taxRate)}%${draft.taxInclusive?' termasuk':''}`);
      return `<tr><td><b>${escape(item.name||'Item')}</b>${item.description?`<small>${escape(item.description)}</small>`:''}${extras.length?`<small>${escape(extras.join(' · '))}</small>`:''}</td><td>${Number(item.qty)||0}${item.unit?` ${escape(item.unit)}`:''}</td><td>${money(item.price,draft.currency)}</td><td>${money(c.lines[i]?.total||0,draft.currency)}</td></tr>`;
    }).join('')||`<tr><td>Produk / Jasa</td><td>1</td><td>${money(0,draft.currency)}</td><td>${money(0,draft.currency)}</td></tr>`;
  }

  function summary(draft){
    const c=calc(draft);
    return `<div class="inv-summary">
      <div class="sum-row"><span>Subtotal</span><b>${money(c.gross,draft.currency)}</b></div>
      ${c.lineDiscount?`<div class="sum-row"><span>Diskon item</span><b>- ${money(c.lineDiscount,draft.currency)}</b></div>`:''}
      ${Number(draft.discount)?`<div class="sum-row"><span>Diskon invoice (${Number(draft.discount)}%)</span><b>- ${money(c.invoiceDiscount,draft.currency)}</b></div>`:''}
      ${c.tax?`<div class="sum-row"><span>Pajak${draft.taxInclusive?' (termasuk)':''}</span><b>${money(c.tax,draft.currency)}</b></div>`:''}
      ${Number(draft.shipping)?`<div class="sum-row"><span>Ongkir / biaya lain</span><b>${money(draft.shipping,draft.currency)}</b></div>`:''}
      <div class="sum-row total"><span>TOTAL</span><span>${money(c.total,draft.currency)}</span></div>
    </div>`;
  }

  function paymentBlock(profile,draft,template){
    const bank=[profile.bankName,profile.bankAccount,profile.bankHolder].filter(Boolean).join(' · ');
    const info=draft.paymentInfo||bank||profile.ewallet||'-';
    const settings=template.settings||{};
    return `<div class="inv-bottom"><div class="inv-payment-wrap">
      <div class="inv-payment"><b>Informasi pembayaran</b><br>${nl(info)}</div>
      ${profile.qris&&settings.showQris!==false?`<div class="inv-qris"><img src="${escape(profile.qris)}" alt="QRIS"><span>QRIS</span></div>`:''}
      <div class="inv-note"><b>Catatan</b><br>${nl(draft.notes||'-')}</div>
    </div>${profile.signature&&settings.showSignature!==false?`<div class="inv-signature"><img src="${escape(profile.signature)}" alt="Tanda tangan"><div class="sign-line">${escape(profile.name||'')}</div></div>`:''}</div>
    ${settings.footerText===false?'':`<div class="inv-footer">${escape(settings.footerText||'Terima kasih telah berbisnis bersama kami.')}</div>`}`;
  }

  function documentTitle(draft){ return draft.documentType==='quote'?'PENAWARAN':draft.documentType==='receipt'?'KWITANSI':'INVOICE'; }
  function standard(profile,draft,template){
    const settings=template.settings||{};
    const title=documentTitle(draft);
    return `<div class="inv-wrap ${template.layout.class||''}" style="--tpl-font:${escape(settings.font||'Inter,Arial,sans-serif')};--tpl-radius:${Number(settings.radius??10)}px;--tpl-logo:${Number(settings.logoSize??56)}px;--tpl-margin:${Number(settings.margin??46)}px">
      ${settings.watermark?`<div class="inv-watermark">${escape(settings.watermark)}</div>`:''}
      <div class="inv-brand"><div class="inv-brand-company">${profile.logo&&settings.showLogo!==false?`<img class="inv-logo" src="${escape(profile.logo)}" alt="Logo">`:''}<div class="inv-business"><h2>${escape(profile.name||'Nama Usaha')}</h2><p>${nl(profile.address||'')}</p><p>${escape(profile.phone||'')}${profile.email?` · ${escape(profile.email)}`:''}</p></div></div><div class="inv-heading"><h1 class="inv-title">${title}</h1><div class="inv-meta"><p><b>${escape(draft.number||'-')}</b></p><p>Tanggal: ${date(draft.date)}</p><p>${draft.documentType==='quote'?'Berlaku sampai':'Jatuh tempo'}: ${date(draft.due)}</p></div></div></div>
      <div class="inv-divider"></div><div class="inv-bill-row"><div class="inv-customer"><div class="inv-label">${draft.documentType==='quote'?'UNTUK':'DITAGIHKAN KEPADA'}</div><h3>${escape(draft.customerName||'Nama Pelanggan')}</h3><p>${nl(draft.customerAddress||'')}</p><p>${escape(draft.customerPhone||'')}${draft.customerEmail?` · ${escape(draft.customerEmail)}`:''}</p></div><div class="inv-customer inv-from"><div class="inv-label">DARI</div><h3>${escape(profile.name||'')}</h3><p>${escape(profile.phone||'')}</p></div></div>
      <table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>HARGA</th><th>JUMLAH</th></tr></thead><tbody>${itemRows(draft)}</tbody></table>${draft._pageNotLast?`<div class="inv-page-cont">Bersambung ke halaman ${Number(draft._pageIndex||1)+1} dari ${draft._pageCount||1}</div>`:`${summary(draft)}${paymentBlock(profile,draft,template)}`}
    </div>`;
  }
  function bold(profile,draft,template){const html=standard(profile,draft,template),divider='<div class="inv-divider"></div>',dividerAt=html.indexOf(divider),brandStart=html.indexOf('<div class="inv-brand">');if(dividerAt<0||brandStart<0)return html;const brand=html.slice(brandStart,dividerAt),body=html.slice(dividerAt+divider.length,html.lastIndexOf('</div>'));return `<div class="inv-wrap layout-bold">${brand}<div class="inv-body">${body}</div></div>`;}
  function render(target,profile,draft,template){if(!target||!profile||!draft||!template)return;target.style.setProperty('--tpl-accent',template.palette.accent);target.style.setProperty('--tpl-soft',template.palette.soft);target.innerHTML=template.layout.id==='bold'?bold(profile,draft,template):standard(profile,draft,template);}
  window.InvoiceRenderer={calc,money,date,render};
})();
