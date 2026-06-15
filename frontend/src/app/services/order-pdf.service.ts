import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Order, OrderItem } from '../models/admin.model';
import { ToastMessageService } from '../core/services/toast-message.service';
import { DateService } from '../core/services/date.service';
import { BRAND_COLOR_PALETTE } from '../core/constants/order.constants';
import { COMPANY_INFO } from '../core/constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class OrderPdfService {
  private toast = inject(ToastMessageService);
  private dateService = inject(DateService);

  private money(value: number): string {
    const [int, dec] = (Math.round(value * 100) / 100).toFixed(2).split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + dec;
  }

  private getColisageLabel(packagingType: string, quantity: number): string {
    const t = (packagingType || 'carton').toLowerCase().trim();
    const plural = quantity !== 1;
    const map: Record<string, [string, string]> = {
      'carton':    ['carton',    'cartons'],
      'fardeau':   ['fardeau',   'fardeaux'],
      'bundle':    ['fardeau',   'fardeaux'],
      'paquet':    ['paquet',    'paquets'],
      'pack':      ['paquet',    'paquets'],
      'bouteille': ['bouteille', 'bouteilles'],
      'bottle':    ['bouteille', 'bouteilles'],
      'sachet':    ['sachet',    'sachets'],
      'bag':       ['sachet',    'sachets'],
      'boite':     ['boîte',     'boîtes'],
      'boîte':     ['boîte',     'boîtes'],
      'box':       ['boîte',     'boîtes'],
      'palette':   ['palette',   'palettes'],
      'crate':     ['caisse',    'caisses'],
    };
    const entry = map[t];
    if (!entry) return t;
    return plural ? entry[1] : entry[0];
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror   = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private buildItemRows(items: OrderItem[], imgUrls: (string | null)[], brandColorMap: Map<string, { bg: string; text: string }>): string {
    return items.map((item, i) => {
      const imgSrc = imgUrls[i];
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;display:block;margin:auto;" />`
        : '<div style="width:32px;height:32px;background:#f1f5f9;border-radius:6px;margin:auto;display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 9 4-4 4 4 4-4 4 4"/><path d="M3 15h18"/></svg></div>';

      const ppb     = item.pieces_per_box || 1;
      const cartons = ppb > 1 ? Math.floor(item.quantity / ppb) : 0;
      const colisage = ppb > 1
        ? `${cartons} ${this.getColisageLabel(item.packaging_type || 'carton', cartons)}`
        : `${item.quantity} ${item.product_unit}`;
      const effectivePrice = item.custom_unit_price ?? item.unit_price;
      const total = effectivePrice * item.quantity;
      const originalTotal = item.unit_price * item.quantity;
      const hasItemDiscount = item.custom_unit_price != null && item.custom_unit_price < item.unit_price;

      const brandHtml = (() => {
        const clr = item.brand_name ? brandColorMap.get(item.brand_name) : null;
        return clr
          ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${clr.bg};color:${clr.text};font-size:11px;font-weight:600;">${item.brand_name}</span>`
          : '—';
      })();

      const priceHtml = item.custom_unit_price != null
        ? `<span style="text-decoration:line-through;color:#f87171;font-size:11px;">${this.money(item.unit_price)} DA</span><br><span style="color:#16a34a;font-weight:600;">${this.money(item.custom_unit_price)} DA</span>`
        : `${this.money(item.unit_price)} DA`;

      return `
        <tr>
          <td style="text-align:center;padding:6px 4px;">${imgHtml}</td>
          <td style="text-align:left;">${item.product_name}</td>
          <td style="text-align:left;">${brandHtml}</td>
          <td>${colisage}</td>
          <td>${item.quantity} ${item.product_unit}</td>
          <td>${priceHtml}</td>
          <td>${hasItemDiscount
            ? `<span style="text-decoration:line-through;color:#f87171;font-size:11px;">${this.money(originalTotal)} DA</span><br><strong style="color:#16a34a;">${this.money(total)} DA</strong>`
            : `<strong>${this.money(total)} DA</strong>`
          }</td>
        </tr>`;
    }).join('');
  }

  private buildHtml(
    order: Order,
    imageDataUrls: (string | null)[],
    logoDataUrl: string | null,
    pageItems?: OrderItem[],
    pageImgUrls?: (string | null)[],
    fixedPage1 = false,
    pageNum = 1,
    totalPages = 1
  ): string {
    const date         = this.dateService.formatDate(order.created_at);
    const customerName = order.user?.full_name || `Client #${order.user_id}`;
    const allItems     = order.items ?? [];
    const items        = pageItems   ?? allItems;
    const imgUrls      = pageImgUrls ?? imageDataUrls;

    const uniqueBrands = [...new Set(allItems.map(i => i.brand_name).filter(Boolean))] as string[];
    const brandColorMap = new Map(uniqueBrands.map((b, i) => [b, BRAND_COLOR_PALETTE[i % BRAND_COLOR_PALETTE.length]]));

    const grossTotal = allItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const actualItemsTotal = allItems.reduce((sum, item) => sum + (item.custom_unit_price ?? item.unit_price) * item.quantity, 0);
    const remise = Math.round((grossTotal - actualItemsTotal) * 100) / 100;
    const hasRemise = remise > 0.01;
    const shipping = order.shipping_cost ?? 0;
    const originalShipping = order.original_shipping_cost ?? shipping;
    const shippingDiscountAmount = Math.round((originalShipping - shipping) * 100) / 100;
    const hasShippingDiscount = shippingDiscountAmount > 0.01;
    const shippingDiscountPercent = hasShippingDiscount ? Math.round(shippingDiscountAmount / originalShipping * 100) : 0;
    const grandTotal = actualItemsTotal + shipping;
    const totalPaid = order.total_paid ?? 0;
    const balance = Math.round((grandTotal - totalPaid) * 100) / 100;

    const deliveryType = order.delivery_type?.toLowerCase();
    const deliveryTypeLabel = deliveryType === 'pickup'
      ? 'Retrait'
      : deliveryType === 'priority'
        ? 'Livraison Premium'
        : 'Livraison Standard';

    const driverLine = order.driver
      ? `<br><span style="font-size:10px;color:#64748b;">Livreur : ${order.driver.full_name}</span>`
      : '';

    const discountLine = (order.discount_amount && order.discount_amount > 0)
      ? `<div class="summary-row"><span>Sous-total</span><strong>${this.money(order.subtotal ?? order.total_amount + order.discount_amount)} DA</strong></div>
         <div class="summary-row red"><span>Remise</span><strong>- ${this.money(order.discount_amount)} DA</strong></div>`
      : '';

    const itemRows = this.buildItemRows(items, imgUrls, brandColorMap);

    const invoiceStyle = fixedPage1
      ? 'style="height:297mm;display:flex;flex-direction:column;overflow:hidden;padding-bottom:20px;"'
      : '';

    const spacer = fixedPage1
      ? `<div style="flex:1;min-height:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 28px 6px;">
           <span style="font-size:10px;color:#64748b;font-style:italic;letter-spacing:.3px;">Suite page suivante &rarr;</span>
         </div>`
      : '';

    const pageNumHtml = `
      <div class="inv-meta-block">
        <span class="inv-meta-label">Page</span>
        <span class="inv-meta-value">${pageNum}/${totalPages}</span>
      </div>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #071b4d; background: white; }
  .invoice { width: 210mm; background: white; }

  .inv-top-row {
    padding: 22px 36px 18px;
    display: flex; align-items: center; justify-content: space-between; gap: 32px;
    border-bottom: 1px solid #e4ecf8;
  }
  .inv-doctype { font-size: 26px; font-weight: 900; color: #041f58; letter-spacing: 5px; flex: 1; }
  .inv-doctype-sub { font-size: 9px; color: #aab4c8; font-weight: 500; letter-spacing: 1px; margin-top: 4px; }
  .inv-logo-center { flex: 1; display: flex; justify-content: center; }
  .inv-logo { height: 50px; width: auto; display: block; }
  .inv-meta-group { flex: 1; display: flex; gap: 24px; align-items: flex-start; justify-content: flex-end; }
  .inv-meta-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .inv-meta-label { font-size: 7.5px; color: #aab4c8; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .inv-meta-value { font-size: 13px; font-weight: 800; color: #041f58; }

  .inv-footer {
    margin-top: 20px; padding: 10px 36px;
    border-top: 1px solid #e4ecf8; background: #f4f7ff;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .inv-co-name { font-size: 11px; font-weight: 700; color: #041f58; }
  .inv-co-sep  { width: 3px; height: 3px; border-radius: 50%; background: #b0bdd8; }
  .inv-co-sub  { font-size: 8.5px; color: #8a99b8; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 22px 24px 16px; }
  .info-card {
    position: relative; min-height: 130px;
    padding: 20px 20px 18px 90px;
    border-radius: 14px; overflow: hidden;
    background: linear-gradient(135deg, #ffffff, #f8fbff);
    border: 1px solid #dce8f7;
    box-shadow: 0 10px 28px rgba(9,35,80,.06);
  }
  .info-card::before {
    content: ""; position: absolute; inset: 0 auto 0 0;
    width: 7px; background: #08275c;
  }
  .info-card.order { background: linear-gradient(135deg, #ffffff, #f0f9ff); border-color: #bae6fd; }
  .info-card.order::before { background: #0284c7; }
  .icon {
    position: absolute; left: 18px; top: 18px;
    width: 52px; height: 52px; border-radius: 50%;
    display: grid; place-items: center; color: white;
    background: linear-gradient(135deg, #164a96, #071f4c);
    box-shadow: 0 8px 18px rgba(8,39,92,.22);
  }
  .order .icon { background: linear-gradient(135deg, #0284c7, #0c4a6e); box-shadow: 0 8px 18px rgba(2,132,199,.22); }
  .icon svg { width: 24px; height: 24px; }
  .card-title { font-size: 11px; font-weight: 800; color: #08275c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .5px; }
  .order .card-title { color: #0284c7; }
  .card-name { font-size: 12px; font-weight: 800; color: #06183d; margin-bottom: 5px; }
  .card-text { font-size: 11px; line-height: 1.7; color: #334155; }
  .dots {
    position: absolute; width: 80px; height: 80px;
    display: grid; grid-template-columns: repeat(8, 10px);
    grid-template-rows: repeat(8, 10px); opacity: .15;
    right: 0; bottom: 10px;
  }
  .dot { width: 3px; height: 3px; border-radius: 50%; background: #2d74d6; margin: auto; }

  .cards-table-gap { height: 16px; }
  table { width: calc(100% - 48px); margin: 0 24px; border-collapse: separate; border-spacing: 0; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 18px rgba(6,59,136,0.08); overflow: hidden; }
  th { background: #063b88; color: white; padding: 9px 7px; text-align: center; }
  td { padding: 7px; border-bottom: 1px solid #e4ecf5; text-align: center; }
  td:nth-child(2) { text-align: left; }
  tr:last-child td { border-bottom: none; }

  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 24px 0; }
  .notes-box { border: 1px solid #dbe5f0; border-radius: 12px; padding: 12px 14px; font-size: 11px; color: #475569; display: flex; flex-direction: column; gap: 10px; }
  .notes-box h5 { font-size: 10.5px; font-weight: 700; color: #063b88; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .4px; }
  .notes-divider { border: none; border-top: 1px solid #e4ecf5; margin: 0; }
  .summary { border: 1px solid #dbe5f0; border-radius: 12px; padding: 14px; }
  .summary-title { background: #063b88; color: white; padding: 7px 14px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 12px; }
  .summary-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e4ecf5; padding: 6px 0; font-size: 12px; }
  .summary-row.red strong { color: #dc2626; }
  .summary-row.green strong { color: #16a34a; }
  .total { margin-top: 10px; background: linear-gradient(90deg, #041f58, #1a5fc8); color: white; border-radius: 8px; padding: 11px 14px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
  .balance { margin-top: 6px; border: 1.5px solid #dc2626; border-radius: 8px; padding: 8px 14px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: #dc2626; }
</style>
</head>
<body>
<div class="invoice" ${invoiceStyle}>

  <div class="inv-top-row">
    <div class="inv-doctype">
      COMMANDE
      <div class="inv-doctype-sub">#${order.id}</div>
    </div>
    <div class="inv-logo-center">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="inv-logo" alt="Logo" />` : ''}
    </div>
    <div class="inv-meta-group">
      <div class="inv-meta-block">
        <span class="inv-meta-label">Date</span>
        <span class="inv-meta-value">${date}</span>
      </div>
      ${pageNumHtml}
    </div>
  </div>

  <div class="cards">
    <div class="info-card">
      <div class="dots">${Array.from({length: 64}, () => '<div class="dot"></div>').join('')}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21c.8-4.4 4-7 8-7s7.2 2.6 8 7H4Z"/>
        </svg>
      </div>
      <div class="card-title">Client</div>
      <div class="card-name">${customerName}</div>
      <div class="card-text">${[
        order.contact_phone ? `📞 ${order.contact_phone}` : '',
        order.shipping_address ?? '',
      ].filter(Boolean).join('<br>')}${driverLine}</div>
    </div>

    <div class="info-card order">
      <div class="dots">${Array.from({length: 64}, () => '<div class="dot"></div>').join('')}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14"/>
          <path d="M12 5l7 7-7 7"/>
        </svg>
      </div>
      <div class="card-title">Livraison</div>
      <div class="card-name">${deliveryTypeLabel}</div>
      <div class="card-text">${[
        order.delivery_notes ?? '',
        order.pickup_date ? `Date retrait : ${this.dateService.formatDate(order.pickup_date)}` : '',
        order.driver ? `Livreur : ${order.driver.full_name}` : '',
      ].filter(Boolean).join('<br>') || (deliveryType === 'pickup' ? 'Retrait en dépôt' : 'Livraison à domicile')}</div>
    </div>
  </div>
  <div class="cards-table-gap"></div>

  <table>
    <thead>
      <tr>
        <th style="width:42px;"></th>
        <th style="text-align:left;">Produit</th>
        <th style="text-align:left;">Marque</th>
        <th>Colisage</th>
        <th>Qté</th>
        <th>Prix Unitaire</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="width:calc(100% - 48px);margin:6px 24px 0;text-align:right;font-size:11px;color:#64748b;">
    ${allItems.length} article${allItems.length > 1 ? 's' : ''}
  </div>

  ${spacer}

  <div class="bottom">
    <div class="notes-box">
      <div>
        ${logoDataUrl ? `<img src="${logoDataUrl}" style="height:32px;width:auto;display:block;margin-bottom:8px;" alt="Logo" />` : `<h5>${COMPANY_INFO.NAME}</h5>`}
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#063b88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span style="font-size:10.5px;color:#334155;">${COMPANY_INFO.PHONE_1}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#063b88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span style="font-size:10.5px;color:#334155;">${COMPANY_INFO.EMAIL}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#063b88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style="font-size:10.5px;color:#334155;">${COMPANY_INFO.ADDRESS}, ${COMPANY_INFO.CITY}</span>
          </div>
        </div>
      </div>
      <hr class="notes-divider">
      <div>
        <h5>Notes de livraison</h5>
        <div style="font-size:10.5px;color:#475569;margin-top:4px;">${order.delivery_notes ?? '<span style="color:#94a3b8;font-style:italic;">Aucune note</span>'}</div>
      </div>
    </div>
    <div class="summary">
      <div class="summary-title">RÉCAPITULATIF</div>
      ${discountLine}
      ${hasRemise ? `
        <div class="summary-row"><span>Prix catalogue</span><strong>${this.money(grossTotal)} DA</strong></div>
        <div class="summary-row red"><span>Remise</span><strong>- ${this.money(remise)} DA</strong></div>
      ` : ''}
      <div class="summary-row green">
        <span>Frais de livraison${hasShippingDiscount ? ` <span style="font-size:10px;font-weight:700;background:#d1fae5;color:#047857;padding:1px 6px;border-radius:4px;margin-left:4px;">-${shippingDiscountPercent}%</span>` : ''}</span>
        <strong>${shipping > 0
          ? (hasShippingDiscount
              ? `<span style="text-decoration:line-through;color:#f87171;font-size:10px;font-weight:400;margin-right:4px;">${this.money(originalShipping)} DA</span>+ ${this.money(shipping)}`
              : '+ ' + this.money(shipping))
          : '—'} DA</strong>
      </div>
      <div class="total"><span>TOTAL</span><span>${this.money(grandTotal)} DA</span></div>
      ${balance > 0.01 ? `
        <div class="balance"><span>SOLDE IMPAYÉ</span><span>${this.money(balance)} DA</span></div>
      ` : ''}
    </div>
  </div>


</div>
</body>
</html>`;
  }

  private buildContinuationHtml(
    pageImgUrls: (string | null)[],
    pageItems: OrderItem[],
    brandColorMap: Map<string, { bg: string; text: string }>
  ): string {
    const itemRows = this.buildItemRows(pageItems, pageImgUrls, brandColorMap);
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #071b4d; background: white; }
  .invoice { width: 210mm; background: white; padding: 24px 0; }
  table { width: calc(100% - 48px); margin: 0 24px; border-collapse: separate; border-spacing: 0; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 18px rgba(6,59,136,0.08); overflow: hidden; }
  th { background: #063b88; color: white; padding: 9px 7px; text-align: center; }
  td { padding: 7px; border-bottom: 1px solid #e4ecf5; text-align: center; }
  td:nth-child(2) { text-align: left; }
  tr:last-child td { border-bottom: none; }
</style>
</head>
<body>
<div class="invoice">
  <table>
    <thead>
      <tr>
        <th style="width:42px;"></th>
        <th style="text-align:left;">Produit</th>
        <th style="text-align:left;">Marque</th>
        <th>Colisage</th>
        <th>Qté</th>
        <th>Prix Unitaire</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>
</body>
</html>`;
  }

  private makeIframe(width: number, height = 1): HTMLIFrameElement {
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;top:0;left:-9999px;width:${width}px;height:${height}px;border:none;`;
    document.body.appendChild(f);
    return f;
  }

  private async canvasFromIframe(f: HTMLIFrameElement, width: number): Promise<HTMLCanvasElement> {
    const el = f.contentDocument!.querySelector('.invoice') as HTMLElement;
    return html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', windowWidth: width });
  }

  async generateOrderPdf(order: Order): Promise<void> {
    if (!order.items || order.items.length === 0) {
      this.toast.showWarn('La commande est vide');
      return;
    }

    try {
      // Sort items by brand name
      const sortedItems = [...order.items].sort((a, b) => {
        if (!a.brand_name && b.brand_name) return 1;
        if (a.brand_name && !b.brand_name) return -1;
        return (a.brand_name || '').localeCompare(b.brand_name || '');
      });
      const sortedOrder = { ...order, items: sortedItems };

      const uniqueBrands = [...new Set(sortedItems.map(i => i.brand_name).filter(Boolean))] as string[];
      const brandColorMap = new Map(uniqueBrands.map((b, i) => [b, BRAND_COLOR_PALETTE[i % BRAND_COLOR_PALETTE.length]]));

      const [imageDataUrls, logoDataUrl] = await Promise.all([
        Promise.all(sortedItems.map(item =>
          item.image_url ? this.loadImageAsDataUrl(item.image_url) : Promise.resolve(null)
        )),
        this.loadImageAsDataUrl('/logo.png'),
      ]);

      const W      = 794;
      const A4_PX  = Math.round(W * 297 / 210); // ≈ 1123 px

      // ── Step 1: Render full doc to measure section heights ──────────────────
      const mf = this.makeIframe(W);
      mf.contentDocument!.open();
      mf.contentDocument!.write(this.buildHtml(sortedOrder, imageDataUrls, logoDataUrl));
      mf.contentDocument!.close();
      await new Promise(r => setTimeout(r, 300));

      const md  = mf.contentDocument!;
      const inv = md.querySelector('.invoice') as HTMLElement;
      mf.style.height = inv.scrollHeight + 'px';

      const invTop    = inv.getBoundingClientRect().top;
      const tbodyEl   = md.querySelector('tbody') as HTMLElement;
      const bottomEl  = md.querySelector('.bottom') as HTMLElement;

      const tbodyTopPx  = tbodyEl.getBoundingClientRect().top - invTop;
      const summaryPx   = bottomEl.getBoundingClientRect().height + 18; // 18px margin-top

      const availForRows = A4_PX - tbodyTopPx - summaryPx - 20 - 16;

      const trs = md.querySelectorAll('tbody tr');
      let cutoff = trs.length;
      let rowSum = 0;
      for (let i = 0; i < trs.length; i++) {
        const rh = (trs[i] as HTMLElement).getBoundingClientRect().height;
        if (rowSum + rh > availForRows) { cutoff = i; break; }
        rowSum += rh;
      }
      document.body.removeChild(mf);

      // ── Step 2: Calculate pages ─────────────────────────────────────────────
      const hasOverflow = cutoff < sortedItems.length;
      const p1Items = sortedItems.slice(0, cutoff);
      const p1Imgs  = imageDataUrls.slice(0, cutoff);

      const avgRowH      = cutoff > 0 ? rowSum / cutoff : 42;
      const contAvail    = A4_PX - 80;
      const contPerPage  = Math.max(1, Math.floor(contAvail / avgRowH));
      const contCount    = sortedItems.length - cutoff;
      const totalPages   = 1 + (hasOverflow ? Math.ceil(contCount / contPerPage) : 0);

      // ── Step 3: Render page 1 ───────────────────────────────────────────────
      const p1f = this.makeIframe(W, hasOverflow ? A4_PX : 1);
      p1f.contentDocument!.open();
      p1f.contentDocument!.write(
        this.buildHtml(sortedOrder, p1Imgs, logoDataUrl, p1Items, p1Imgs, hasOverflow, 1, totalPages)
      );
      p1f.contentDocument!.close();
      await new Promise(r => setTimeout(r, 300));

      if (!hasOverflow) {
        const el = p1f.contentDocument!.querySelector('.invoice') as HTMLElement;
        p1f.style.height = el.scrollHeight + 'px';
      }
      const p1c = await this.canvasFromIframe(p1f, W);
      document.body.removeChild(p1f);

      // ── Step 4: Build PDF ───────────────────────────────────────────────────
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const p1Hmm  = hasOverflow ? 297 : (p1c.height * 210 / p1c.width);
      pdf.addImage(p1c.toDataURL('image/png'), 'PNG', 0, 0, 210, p1Hmm);

      // ── Step 5: Continuation pages ──────────────────────────────────────────
      if (hasOverflow) {
        const exItems = sortedItems.slice(cutoff);
        const exImgs  = imageDataUrls.slice(cutoff);

        const exf = this.makeIframe(W);
        exf.contentDocument!.open();
        exf.contentDocument!.write(this.buildContinuationHtml(exImgs, exItems, brandColorMap));
        exf.contentDocument!.close();
        await new Promise(r => setTimeout(r, 300));

        const exEl = exf.contentDocument!.querySelector('.invoice') as HTMLElement;
        exf.style.height = exEl.scrollHeight + 'px';
        const exc = await this.canvasFromIframe(exf, W);
        document.body.removeChild(exf);

        const pageHpx = Math.round(exc.width * 297 / 210);
        let off = 0;
        let contPageIdx = 2;
        while (off < exc.height) {
          const sh  = Math.min(pageHpx, exc.height - off);
          const sc  = document.createElement('canvas');
          sc.width  = exc.width;
          sc.height = sh;
          const sctx = sc.getContext('2d')!;
          sctx.drawImage(exc, 0, -off);
          sctx.font      = 'bold 22px Arial';
          sctx.fillStyle = '#8a99b8';
          sctx.textAlign = 'right';
          sctx.fillText(`Page ${contPageIdx} / ${totalPages}`, sc.width - 48, sc.height - 28);
          pdf.addPage();
          pdf.addImage(sc.toDataURL('image/png'), 'PNG', 0, 0, 210, sh * 210 / exc.width);
          off += pageHpx;
          contPageIdx++;
        }
      }

      // ── Step 6: Output ──────────────────────────────────────────────────────
      const blob = pdf.output('blob');
      const url  = URL.createObjectURL(blob);
      const pif  = document.createElement('iframe');
      pif.style.display = 'none';
      pif.src = url;
      document.body.appendChild(pif);
      pif.onload = () => {
        pif.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(pif); URL.revokeObjectURL(url); }, 60000);
      };
    } catch (err: any) {
      this.toast.showError('Erreur lors de la génération du PDF: ' + (err?.message ?? String(err)));
    }
  }
}
