(() => {
  const escape = window.InvoiceTemplates.escape;
  const nl = value => escape(value || '').replace(/\n/g,'<br>');
  const money = (value, currency='IDR') => new Intl.NumberFormat('id-ID', {
    style:'currency', currency, maximumFractionDigits:currency === 'IDR' ? 0 : 2
  }).format(Number(value) || 0);
  const date = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';

  function calc(draft){
    const subtotal = (draft.items || []).reduce((sum,item) => sum + (Number(item.qty)||0) * (Number(item.price)||0),0);
    const disc = subtotal * (Number(draft.discount)||0) / 100;
    const after = subtotal - disc;
    const taxValue = after * (Number(draft.tax)||0) / 100;
    const total = after + taxValue + (Number(draft.shipping)||0);
    return {subtotal,disc,tax:taxValue,total};
  }

  function itemRows(draft){
    return (draft.items || []).map(item => `<tr>
      <td><b>${escape(item.name || 'Item')}</b>${item.description ? `<small>${escape(item.description)}</small>` : ''}</td>
      <td>${Number(item.qty)||0}${item.unit ? ` ${escape(item.unit)}` : ''}</td>
      <td>${money(item.price,draft.currency)}</td>
      <td>${money((Number(item.qty)||0)*(Number(item.price)||0),draft.currency)}</td>
    </tr>`).join('') || `<tr><td>Produk / Jasa</td><td>1</td><td>${money(0,draft.currency)}</td><td>${money(0,draft.currency)}</td></tr>`;
  }

  function summary(draft){
    const c = calc(draft);
    return `<div class="inv-summary">
      <div class="sum-row"><span>Subtotal</span><b>${money(c.subtotal,draft.currency)}</b></div>
      ${Number(draft.discount) ? `<div class="sum-row"><span>Diskon (${Number(draft.discount)}%)</span><b>- ${money(c.disc,draft.currency)}</b></div>` : ''}
      ${Number(draft.tax) ? `<div class="sum-row"><span>Pajak (${Number(draft.tax)}%)</span><b>${money(c.tax,draft.currency)}</b></div>` : ''}
      ${Number(draft.shipping) ? `<div class="sum-row"><span>Ongkir</span><b>${money(draft.shipping,draft.currency)}</b></div>` : ''}
      <div class="sum-row total"><span>TOTAL</span><span>${money(c.total,draft.currency)}</span></div>
    </div>`;
  }

  function paymentBlock(profile,draft){
    const bank = [profile.bankName,profile.bankAccount,profile.bankHolder].filter(Boolean).join(' · ');
    const info = draft.paymentInfo || bank || profile.ewallet || '-';
    return `<div class="inv-bottom"><div class="inv-payment-wrap">
      <div class="inv-payment"><b>Informasi pembayaran</b><br>${nl(info)}</div>
      ${profile.qris ? `<div class="inv-qris"><img src="${escape(profile.qris)}" alt="QRIS"><span>QRIS</span></div>` : ''}
      <div class="inv-note"><b>Catatan</b><br>${nl(draft.notes || '-')}</div>
    </div>
    ${profile.signature ? `<div class="inv-signature"><img src="${escape(profile.signature)}" alt="Tanda tangan"><div class="sign-line">${escape(profile.name || '')}</div></div>` : ''}</div>
    <div class="inv-footer">Terima kasih telah berbisnis bersama kami.</div>`;
  }

  function standard(profile,draft,template){
    return `<div class="inv-wrap ${template.layout.class || ''}">
      <div class="inv-brand">
        <div class="inv-brand-company">${profile.logo ? `<img class="inv-logo" src="${escape(profile.logo)}" alt="Logo">` : ''}<div class="inv-business"><h2>${escape(profile.name || 'Nama Usaha')}</h2><p>${nl(profile.address || '')}</p><p>${escape(profile.phone || '')}${profile.email ? ` · ${escape(profile.email)}` : ''}</p></div></div>
        <div class="inv-heading"><h1 class="inv-title">INVOICE</h1><div class="inv-meta"><p><b>${escape(draft.number || '-')}</b></p><p>Tanggal: ${date(draft.date)}</p><p>Jatuh tempo: ${date(draft.due)}</p></div></div>
      </div>
      <div class="inv-divider"></div>
      <div class="inv-bill-row"><div class="inv-customer"><div class="inv-label">DITAGIHKAN KEPADA</div><h3>${escape(draft.customerName || 'Nama Pelanggan')}</h3><p>${nl(draft.customerAddress || '')}</p><p>${escape(draft.customerPhone || '')}${draft.customerEmail ? ` · ${escape(draft.customerEmail)}` : ''}</p></div><div class="inv-customer inv-from"><div class="inv-label">DARI</div><h3>${escape(profile.name || '')}</h3><p>${escape(profile.phone || '')}</p></div></div>
      <table class="inv-table"><thead><tr><th>DESKRIPSI</th><th>QTY</th><th>HARGA</th><th>JUMLAH</th></tr></thead><tbody>${itemRows(draft)}</tbody></table>
      ${summary(draft)}${paymentBlock(profile,draft)}
    </div>`;
  }

  function bold(profile,draft,template){
    const html = standard(profile,draft,template);
    const divider = '<div class="inv-divider"></div>';
    const dividerAt = html.indexOf(divider);
    const brandStart = html.indexOf('<div class="inv-brand">');
    const brand = html.slice(brandStart,dividerAt);
    const body = html.slice(dividerAt + divider.length, html.lastIndexOf('</div>'));
    return `<div class="inv-wrap layout-bold">${brand}<div class="inv-body">${body}</div></div>`;
  }

  function render(target, profile, draft, template){
    if(!target || !profile || !draft || !template) return;
    target.style.setProperty('--tpl-accent',template.palette.accent);
    target.style.setProperty('--tpl-soft',template.palette.soft);
    target.innerHTML = template.layout.id === 'bold' ? bold(profile,draft,template) : standard(profile,draft,template);
  }

  window.InvoiceRenderer = { calc, money, date, render };
})();
