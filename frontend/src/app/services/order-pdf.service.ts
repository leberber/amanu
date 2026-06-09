import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import qrcode from 'qrcode-generator';
import { Order } from '../models/admin.model';
import { ToastMessageService } from '../core/services/toast-message.service';
import { DateService } from '../core/services/date.service';
import { ORDER_STATUS_CONFIG, BRAND_COLOR_PALETTE } from '../core/constants/order.constants';
import { COMPANY_INFO } from '../core/constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class OrderPdfService {
  private toast = inject(ToastMessageService);
  private dateService = inject(DateService);

  private money(value: number): string {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending':   'En attente',
      'confirmed': 'Confirmée',
      'assigned':  'Assignée',
      'picked_up': 'Récupérée',
      'in_transit':'En transit',
      'delivered': 'Livrée',
      'cancelled': 'Annulée',
      'ready':     'Prête'
    };
    return labels[status] || status;
  }

  private getStatusColor(status: string): { bg: string; text: string } {
    const cfg = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    if (cfg) return { bg: cfg.bgColor, text: cfg.color };
    return { bg: '#f3f4f6', text: '#374151' };
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

  private generateQrDataUrl(): string {
    const qr = qrcode(0, 'M');
    qr.addData(COMPANY_INFO.PLAY_STORE_URL);
    qr.make();
    return qr.createDataURL(4, 0);
  }

  private buildHtml(
    order: Order,
    imageDataUrls: (string | null)[],
    logoDataUrl: string | null,
    qrDataUrl: string
  ): string {
    const date       = this.dateService.formatDate(order.created_at);
    const customerName = order.user?.full_name || `Client #${order.user_id}`;
    const items = order.items ?? [];

    // Build brand → color map (each unique brand gets a distinct color from constants)
    const uniqueBrands = [...new Set(items.map(i => i.brand_name).filter(Boolean))] as string[];
    const brandColorMap = new Map(uniqueBrands.map((b, i) => [b, BRAND_COLOR_PALETTE[i % BRAND_COLOR_PALETTE.length]]));

    const deliveryTypeLabel = order.delivery_type?.toLowerCase() === 'pickup'
      ? 'Retrait en dépôt'
      : order.delivery_type?.toLowerCase() === 'priority'
        ? 'Prioritaire'
        : 'Standard';

    const itemRows = items.map((item, i) => {
      const imgSrc = imageDataUrls[i];
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;display:block;margin:auto;" />`
        : '<div style="width:32px;height:32px;background:#f1f5f9;border-radius:6px;margin:auto;display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 9 4-4 4 4 4-4 4 4"/><path d="M3 15h18"/></svg></div>';

      const ppb    = item.pieces_per_box || 1;
      const cartons = ppb > 1 ? Math.floor(item.quantity / ppb) : 0;
      const colisage = ppb > 1
        ? `${cartons} ${this.getColisageLabel(item.packaging_type || 'carton', cartons)}`
        : `${item.quantity} ${item.product_unit}`;
      const total = item.unit_price * item.quantity;

      return `
        <tr>
          <td style="text-align:center;padding:6px 4px;">${imgHtml}</td>
          <td style="text-align:left;">${item.product_name}</td>
          <td style="text-align:left;">${(() => { const clr = item.brand_name ? brandColorMap.get(item.brand_name) : null; return clr ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${clr.bg};color:${clr.text};font-size:11px;font-weight:600;">${item.brand_name}</span>` : '—'; })()}</td>
          <td>${colisage}</td>
          <td>${item.quantity} ${item.product_unit}</td>
          <td>${this.money(item.unit_price)} DA</td>
          <td><strong>${this.money(total)} DA</strong></td>
        </tr>`;
    }).join('');

    const discountLine = (order.discount_amount && order.discount_amount > 0)
      ? `<div class="summary-row"><span>Sous-total</span><strong>${this.money(order.subtotal ?? order.total_amount + order.discount_amount)} DA</strong></div>
         <div class="summary-row red"><span>Remise</span><strong>- ${this.money(order.discount_amount)} DA</strong></div>`
      : '';

    const driverLine = order.driver
      ? `<br><span style="font-size:10px;color:#64748b;">Livreur : ${order.driver.full_name}</span>`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #071b4d; background: white; }
  .invoice { width: 210mm; background: white; }

  /* COMPANY HEADER */
  .co-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 36px; background: #041f58; color: white;
  }
  .co-info { display: flex; flex-direction: column; gap: 2px; }
  .co-name { font-size: 14px; font-weight: 900; letter-spacing: 2px; }
  .co-detail { font-size: 8.5px; color: #a8bcd8; }
  .co-qr { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .co-qr img { width: 52px; height: 52px; border-radius: 4px; background: white; padding: 2px; display: block; }
  .co-qr-label { font-size: 7px; color: #a8bcd8; text-align: center; }

  /* HEADER */
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

  /* CARDS */
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

  /* TABLE */
  .cards-table-gap { height: 16px; }
  table { width: calc(100% - 48px); margin: 0 24px; border-collapse: separate; border-spacing: 0; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 18px rgba(6,59,136,0.08); overflow: hidden; }
  th { background: #063b88; color: white; padding: 9px 7px; text-align: center; }
  td { padding: 7px; border-bottom: 1px solid #e4ecf5; text-align: center; }
  td:nth-child(2) { text-align: left; }
  tr:last-child td { border-bottom: none; }

  /* SUMMARY */
  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 24px 0; }
  .notes-box { border: 1px solid #dbe5f0; border-radius: 12px; padding: 14px; font-size: 11px; color: #475569; }
  .notes-box h5 { font-size: 11px; font-weight: 700; color: #063b88; margin-bottom: 6px; }
  .summary { border: 1px solid #dbe5f0; border-radius: 12px; padding: 14px; }
  .summary-title { background: #063b88; color: white; padding: 7px 14px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 12px; }
  .summary-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e4ecf5; padding: 6px 0; font-size: 12px; }
  .summary-row.red strong { color: #dc2626; }
  .total { margin-top: 10px; background: linear-gradient(90deg, #041f58, #1a5fc8); color: white; border-radius: 8px; padding: 11px 14px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
</style>
</head>
<body>
<div class="invoice">

  <div class="co-header">
    <div class="co-info">
      <div class="co-name">${COMPANY_INFO.NAME}</div>
      <div class="co-detail">${COMPANY_INFO.ADDRESS}, ${COMPANY_INFO.CITY}</div>
      <div class="co-detail">${COMPANY_INFO.PHONE_1} &nbsp;·&nbsp; ${COMPANY_INFO.PHONE_2}</div>
      <div class="co-detail">${COMPANY_INFO.WEBSITE} &nbsp;·&nbsp; ${COMPANY_INFO.EMAIL}</div>
    </div>
    <div class="co-qr">
      <img src="${qrDataUrl}" alt="QR" />
      <div class="co-qr-label">Télécharger l'app</div>
    </div>
  </div>

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
      ].filter(Boolean).join('<br>') || 'Livraison à domicile'}</div>
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
    ${items.length} article${items.length > 1 ? 's' : ''}
  </div>

  <div class="bottom">
    <div class="notes-box">
      <h5>Notes de livraison</h5>
      ${order.delivery_notes ?? '<span style="color:#94a3b8;font-style:italic;">Aucune note</span>'}
      ${order.shipping_address ? `<br><br><strong>Adresse :</strong><br>${order.shipping_address}` : ''}
    </div>
    <div class="summary">
      <div class="summary-title">RÉCAPITULATIF</div>
      ${discountLine}
      <div class="total"><span>TOTAL</span><span>${this.money(order.total_amount)} DA</span></div>
    </div>
  </div>

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
      // Sort items by brand name (no-brand items go to the end)
      const sortedItems = [...order.items].sort((a, b) => {
        if (!a.brand_name && b.brand_name) return 1;
        if (a.brand_name && !b.brand_name) return -1;
        return (a.brand_name || '').localeCompare(b.brand_name || '');
      });
      const sortedOrder = { ...order, items: sortedItems };

      const [imageDataUrls, logoDataUrl] = await Promise.all([
        Promise.all(sortedItems.map(item =>
          item.image_url ? this.loadImageAsDataUrl(item.image_url) : Promise.resolve(null)
        )),
        this.loadImageAsDataUrl('/logo.png'),
      ]);

      const W = 794;
      const f = this.makeIframe(W);
      f.contentDocument!.open();
      f.contentDocument!.write(this.buildHtml(sortedOrder, imageDataUrls, logoDataUrl, this.generateQrDataUrl()));
      f.contentDocument!.close();
      await new Promise(r => setTimeout(r, 300));

      const el = f.contentDocument!.querySelector('.invoice') as HTMLElement;
      f.style.height = el.scrollHeight + 'px';
      const canvas = await this.canvasFromIframe(f, W);
      document.body.removeChild(f);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const hMm = canvas.height * 210 / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, hMm);

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
