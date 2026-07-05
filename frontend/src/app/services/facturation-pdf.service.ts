import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { CompanySettings, Facturation } from '../core/services/facturation.service';
import { ToastMessageService } from '../core/services/toast-message.service';
import { DateService } from '../core/services/date.service';

@Injectable({
  providedIn: 'root'
})
export class FacturationPdfService {
  private toast = inject(ToastMessageService);
  private dateService = inject(DateService);
  private logoCache: string | null | undefined = undefined; // undefined = not yet fetched

  private cleanAddress(address: string | null | undefined): string {
    if (!address) return '';
    return address
      .replace(/\b[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\b\s*/g, '')
      .replace(/^[\s,]+/, '')
      .replace(/,?\s*Alg[eé]rie\s*$/i, '')
      .trim();
  }

  private money(value: number): string {
    return Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private numberToWords(amount: number): string {
    const ones = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf',
      'Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize',
      'Dix Sept', 'Dix Huit', 'Dix Neuf'];
    const tens = ['', '', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante',
      'Soixante', 'Quatre Vingt', 'Quatre Vingt'];

    const b100 = (n: number): string => {
      if (n < 20) return ones[n];
      const t = Math.floor(n / 10), u = n % 10;
      if (t === 7) return u === 1 ? 'Soixante et Onze' : 'Soixante ' + ones[10 + u];
      if (t === 8) return u === 0 ? 'Quatre Vingts' : 'Quatre Vingt ' + ones[u];
      if (t === 9) return 'Quatre Vingt ' + ones[10 + u];
      if (u === 0) return tens[t];
      if (u === 1) return tens[t] + ' et Un';
      return tens[t] + ' ' + ones[u];
    };

    const b1000 = (n: number): string => {
      if (n === 0) return '';
      if (n < 100) return b100(n);
      const h = Math.floor(n / 100), r = n % 100;
      const hStr = (h === 1 ? '' : ones[h] + ' ') + 'Cent' + (r === 0 && h > 1 ? 's' : '');
      return r === 0 ? hStr : hStr + ' ' + b100(r);
    };

    const int = Math.floor(amount);
    const dec = Math.round((amount - int) * 100);
    if (int === 0) return 'Zero DA';
    let result = '';
    const M = Math.floor(int / 1_000_000);
    const K = Math.floor((int % 1_000_000) / 1_000);
    const R = int % 1_000;
    if (M > 0) result += (M === 1 ? 'Un Million' : b1000(M) + ' Millions') + ' ';
    if (K > 0) result += (K === 1 ? 'Mille' : b1000(K) + ' Mille') + ' ';
    if (R > 0) result += b1000(R);
    result = result.trim() + ' DA';
    if (dec > 0) result += ' et ' + b100(dec) + ' Cts';
    return result;
  }

  private buildHtml(
    facture: Facturation,
    company: CompanySettings,
    imageDataUrls: (string | null)[],
    logoDataUrl: string | null = null,
    pageItems?: Facturation['items'],
    pageImgUrls?: (string | null)[],
    fixedPage1 = false,
    pageNum = 1,
    totalPages = 1
  ): string {
    const formatPhone = (p: string): string => {
      const digits = p.replace(/\D/g, '');
      // Strip leading country code 213
      const local = digits.startsWith('213') ? '0' + digits.slice(3) : digits;
      // Format as 0X XX XX XX XX (10 digits)
      if (local.length === 10) {
        return local.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
      }
      return p;
    };
    const modeLabel = facture.payment_mode === 'cheque' ? 'CHEQUE'
      : facture.payment_mode === 'virement' ? 'VIREMENT' : 'ESPECE';
    const date = this.dateService.formatDateOnly(facture.created_at);
    const amountWords = this.numberToWords(facture.total_ttc);

    const items    = pageItems   ?? facture.items;
    const imgUrls  = pageImgUrls ?? imageDataUrls;

    const itemRows = items.map((item, i) => {
      const imgSrc = imgUrls[i];
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" style="width:30px;height:30px;object-fit:contain;border-radius:6px;display:block;margin:auto;" />`
        : '';
      const totalPcs = item.quantity * item.pieces_per_box;
      const prixUnite = totalPcs > 0 ? item.total_ht / totalPcs : 0;
      const tvaClass = item.tva_rate === 19 ? 'tva-19' : item.tva_rate === 0 ? 'tva-0' : '';
      return `
        <tr>
          <td style="text-align:center;padding:6px 4px;">${imgHtml}</td>
          <td>${item.product_name}</td>
          <td>${item.brand_name ?? ''}</td>
          <td>${item.pieces_per_box} Pcs X ${item.unit}</td>
          <td>${this.money(prixUnite)}</td>
          <td><span class="tva-pill ${tvaClass}">${item.tva_rate}%</span></td>
          <td>${item.quantity}</td>
          <td><strong>${this.money(item.total_ttc)}</strong></td>
        </tr>`;
    }).join('');



    const remiseLine = facture.remise > 0
      ? `<div class="summary-row"><span>REMISE</span><strong>- ${this.money(facture.remise)}</strong></div>` : '';
    const timbreLine = facture.timbre > 0
      ? `<div class="summary-row timbre-row"><span>TIMBRE</span><strong>${this.money(facture.timbre)}</strong></div>` : '';

    const montantImpose = facture.items.filter(i => i.tva_rate > 0).reduce((s, i) => s + i.total_ht, 0);
    const montantExo    = facture.items.filter(i => i.tva_rate === 0).reduce((s, i) => s + i.total_ht, 0);
    const imposeLine = montantImpose > 0
      ? `<div class="summary-row dimmed"><span>MONTANT IMPOSÉ</span><strong>${this.money(montantImpose)}</strong></div>` : '';
    const exoLine = montantExo > 0
      ? `<div class="summary-row dimmed"><span>MONTANT EXONÉRÉ</span><strong>${this.money(montantExo)}</strong></div>` : '';

    const invoiceStyle = fixedPage1
      ? 'style="height:297mm;display:flex;flex-direction:column;overflow:hidden;padding-bottom:20px;"'
      : '';
    const spacer = fixedPage1
      ? `<div style="flex:1;min-height:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 28px 6px;">
           <span style="font-size:10px;color:#8a99b8;font-style:italic;letter-spacing:.3px;">Suite page suivante &rarr;</span>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; background-repeat: no-repeat !important; }
  body { font-family: Arial, sans-serif; color: #071b4d; background: white; }
  .invoice { width: 210mm; background: white; }

  /* ── HEADER ── */
  .inv-hdr { background: white; }
  .inv-top-row {
    padding: 24px 36px 20px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #e4ecf8;
    gap: 32px;
  }
  .inv-doctype {
    font-size: 28px; font-weight: 900; color: #041f58;
    letter-spacing: 6px; line-height: 1; flex: 1;
  }
  .inv-doctype-sub {
    font-size: 8px; color: #aab4c8; font-weight: 500;
    letter-spacing: 2px; text-transform: uppercase; margin-top: 6px;
  }
  .inv-logo-center { flex: 1; display: flex; justify-content: center; align-items: center; }
  .inv-logo { height: 56px; width: auto; display: block; }
  .inv-meta-group { flex: 1; display: flex; gap: 28px; align-items: flex-start; justify-content: flex-end; }
  .inv-meta-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .inv-meta-label { font-size: 7.5px; color: #aab4c8; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .inv-meta-value { font-size: 12px; font-weight: 800; color: #041f58; }
  .inv-meta-value.green { color: #168a2f; }
  .inv-bot-row {
    padding: 9px 36px; background: #f4f7ff;
    display: flex; align-items: center; gap: 8px;
  }
  .inv-co-name { font-size: 11px; font-weight: 700; color: #041f58; }
  .inv-co-sep { width: 3px; height: 3px; border-radius: 50%; background: #b0bdd8; }
  .inv-co-sub { font-size: 8.5px; color: #8a99b8; }
  .inv-page-txt { margin-left: auto; font-size: 8px; color: #c0cade; font-weight: 600; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 25px 24px 18px; }

  /* ── Cards — exact t.html style ── */
  .info-card {
    position: relative;
    min-height: 150px;
    padding: 22px 24px 20px 100px;
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(135deg, #ffffff, #f8fbff);
    border: 1px solid #dce8f7;
    box-shadow: 0 14px 35px rgba(9,35,80,.07);
  }
  .info-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 8px;
    background: #08275c;
  }
  .info-card.client {
    background: linear-gradient(135deg, #ffffff, #fffaf2);
    border-color: #f4d8a8;
  }
  .info-card.client::before { display: none; }

  .icon {
    position: absolute;
    left: 22px; top: 22px;
    width: 58px; height: 58px;
    border-radius: 50%;
    display: grid; place-items: center;
    color: white;
    background: linear-gradient(135deg, #164a96, #071f4c);
    box-shadow: 0 10px 22px rgba(8,39,92,.25);
  }
  .client .icon {
    background: linear-gradient(135deg, #f8be3b, #d98200);
    box-shadow: 0 10px 22px rgba(217,130,0,.22);
  }
  .icon svg { width: 26px; height: 26px; }

  .card-title { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: #08275c; }
  .client .card-title { color: #e18a00; }
  .card-name { margin: 0 0 6px; font-size: 12px; font-weight: 800; color: #06183d; }
  .card-text { margin: 0; font-size: 11px; line-height: 1.7; font-weight: 500; color: #203050; }

  /* dots — div grid (html2canvas compatible) */
  .dots {
    position: absolute;
    width: 90px; height: 90px;
    display: grid;
    grid-template-columns: repeat(9, 10px);
    grid-template-rows: repeat(9, 10px);
    opacity: .18;
  }
  .supplier .dots { left: 14px; bottom: 18px; }
  .client .dots { right: 0; top: 42px; }
  .supplier .dot { width: 3px; height: 3px; border-radius: 50%; background: #2d74d6; margin: auto; }
  .client .dot  { width: 3px; height: 3px; border-radius: 50%; background: #f2a320; margin: auto; }

  table { width: calc(100% - 48px); margin: 0 24px; border-collapse: separate; border-spacing: 0; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 18px rgba(6,59,136,0.08); overflow: hidden; }
  th { background: #063b88; color: white; padding: 10px 7px; text-align: center; }
  td { padding: 8px 7px; border-bottom: 1px solid #e4ecf5; text-align: center; }
  td:nth-child(2), td:nth-child(3) { text-align: left; }
  tr:last-child td { border-bottom: none; }

  .tva-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: bold; background: #e8f7e5; color: #168a2f; font-size: 11px; }
  .tva-19 { background: #fff0dd; color: #d16600; }
  .tva-0 { background: #f0f0f0; color: #666; }
  .cards-table-gap { height: 20px; }

  .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 18px 24px 0; }
  .amount-box, .summary { border: 1px solid #dbe5f0; border-radius: 12px; padding: 16px; }
  .amount-box { display: flex; flex-direction: column; }
  .amount-box p { font-size: 11px; color: #555; margin-bottom: 8px; }
  .amount-box h4 { color: #063b88; font-size: 15px; margin: 0 0 16px; }
  .stamp { margin-top: 16px; display: inline-block; border: 2px solid #b71c1c; color: #b71c1c; padding: 8px 18px; transform: rotate(-3deg); text-align: center; font-weight: bold; font-size: 10px; line-height: 1.6; }
  .summary-title { background: #063b88; color: white; padding: 8px 14px; border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 13px; }
  .summary-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e4ecf5; padding: 7px 0; font-size: 13px; }
  .green { color: #063b88; }
  .dimmed { color: #9aabbf; font-size: 12px; }
  .dimmed strong { color: #9aabbf; font-weight: 500; }
  .tva-row { color: #c0392b; }
  .tva-row strong { color: #c0392b; }
  .timbre-row { color: #7c5caa; }
  .timbre-row strong { color: #7c5caa; }
  .total { margin-top: 10px; background: linear-gradient(90deg, #041f58, #1a5fc8); color: white; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; font-size: 17px; font-weight: bold; }
  .payment { margin-top: 10px; background: #edf8eb; border-radius: 8px; padding: 9px 12px; display: flex; justify-content: space-between; font-size: 13px; }

</style>
</head>
<body>
<div class="invoice" ${invoiceStyle}>

  <div class="inv-hdr">
    <div class="inv-top-row">
      <div class="inv-doctype">
        ${facture.document_type === 'facture' ? 'FACTURE' : 'BON DE LIVRAISON'}
        ${facture.document_type === 'bon_de_livraison' ? '<div class="inv-doctype-sub">suivi d\'une facture</div>' : ''}
      </div>
      <div class="inv-logo-center">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="inv-logo" alt="Logo" />` : ''}
      </div>
      <div class="inv-meta-group">
        <div class="inv-meta-block">
          <span class="inv-meta-label">Numéro</span>
          <span class="inv-meta-value">${facture.reference}</span>
        </div>
        <div class="inv-meta-block">
          <span class="inv-meta-label">Date</span>
          <span class="inv-meta-value green">${date}</span>
        </div>
        <div class="inv-meta-block">
          <span class="inv-meta-label">Page</span>
          <span class="inv-meta-value">${pageNum}/${totalPages}</span>
        </div>
      </div>
    </div>
    <div class="inv-bot-row">
      <span class="inv-co-name">${company.name}</span>
      ${company.activity ? `<div class="inv-co-sep"></div><span class="inv-co-sub">${company.activity}</span>` : ''}
      ${company.phone ? `<div class="inv-co-sep"></div><span class="inv-co-sub">${formatPhone(company.phone)}</span>` : ''}
      <div class="inv-co-sep"></div><span class="inv-co-sub">${company.email ?? 'support@agroclik.com'}</span>
      ${company.address ? `<div class="inv-co-sep"></div><span class="inv-co-sub">${company.address}</span>` : ''}
      <span class="inv-page-txt">Page ${pageNum}/${totalPages}</span>
    </div>
  </div>

  <div class="cards">
    <div class="info-card supplier">
      <div class="dots">${Array.from({length:81},()=>'<div class="dot"></div>').join('')}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 10h16l-1 10H5L4 10Z"/>
          <path d="M7 10V6h10v4"/>
          <path d="M8 14h8"/>
          <path d="M9 20v-4h6v4"/>
        </svg>
      </div>
      <h3 class="card-title">FOURNISSEUR</h3>
      <p class="card-name">${company.name}</p>
      <p class="card-text">${[
        company.activity,
        company.rc  ? 'RC : '    + company.rc  : '',
        company.na  ? 'N.A : '   + company.na  : '',
        company.nif ? 'N.I.F : ' + company.nif : '',
        company.nis ? 'N.I.S : ' + company.nis : '',
      ].filter(Boolean).join('<br>')}</p>
    </div>

    <div class="info-card client">
      <div class="dots">${Array.from({length:81},()=>'<div class="dot"></div>').join('')}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21c.8-4.4 4-7 8-7s7.2 2.6 8 7H4Z"/>
        </svg>
      </div>
      <h3 class="card-title">CLIENT</h3>
      <p class="card-name">${facture.client_name}</p>
      <p class="card-text">${[
        this.cleanAddress(facture.client_address),
        facture.client_rc  ? 'RC : '    + facture.client_rc  : '',
        facture.client_na  ? 'N.A : '   + facture.client_na  : '',
        facture.client_nif ? 'N.I.F : ' + facture.client_nif : '',
        facture.client_nis ? 'N.I.S : ' + facture.client_nis : '',
      ].filter(Boolean).join('<br>')}</p>
    </div>
  </div>
  <div class="cards-table-gap"></div>

  <table>
    <thead>
      <tr>
        <th style="width:42px;"></th>
        <th style="text-align:left;">Article</th>
        <th style="text-align:left;">Marque</th>
        <th>Colisage</th>
        <th>Prix Unite</th>
        <th>TVA</th>
        <th>Qte</th>
        <th>Total TTC</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${spacer}
  <div class="bottom">
    <div class="amount-box">
      <p>&#8220; Arrêtée la présente facture à la somme de :</p>
      <h4>${amountWords}</h4>
      <div class="stamp">
        AGROCLIK<br />
        MEKHTОUB Yazid<br />
        Locaux N°01-02-03-04 Rue<br />
        HAMDIS Med Amokrane Ouadhias<br />
        T-O R.C n° : 15/02-5241701/A/25
      </div>
      <div class="payment" style="margin-top:auto"><strong>MODE DE PAIEMENT</strong><strong>${modeLabel}</strong></div>
    </div>

    <div class="summary">
      <div class="summary-title">RECAPITULATIF</div>
      <div class="summary-row"><span>TOTAL HT</span><strong>${this.money(facture.total_ht)}</strong></div>
      ${imposeLine}${exoLine}
      ${remiseLine}
      <div class="summary-row tva-row"><span>TVA</span><strong>${this.money(facture.total_tva)}</strong></div>
      ${timbreLine}
      <div class="total"><span>TOTAL TTC</span><span>${this.money(facture.total_ttc)}</span></div>
    </div>
  </div>


</div>
</body>
</html>`;
  }

  private buildContinuationHtml(
    pageImgUrls: (string | null)[],
    pageItems: Facturation['items']
  ): string {
    const itemRows = pageItems.map((item, i) => {
      const imgSrc = pageImgUrls[i];
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" style="width:30px;height:30px;object-fit:contain;border-radius:6px;display:block;margin:auto;" />`
        : '';
      const totalPcs = item.quantity * item.pieces_per_box;
      const prixUnite = totalPcs > 0 ? item.total_ht / totalPcs : 0;
      const tvaClass = item.tva_rate === 19 ? 'tva-19' : item.tva_rate === 0 ? 'tva-0' : '';
      return `
        <tr>
          <td style="text-align:center;padding:6px 4px;">${imgHtml}</td>
          <td>${item.product_name}</td>
          <td>${item.brand_name ?? ''}</td>
          <td>${item.pieces_per_box} Pcs X ${item.unit}</td>
          <td>${this.money(prixUnite)}</td>
          <td><span class="tva-pill ${tvaClass}">${item.tva_rate}%</span></td>
          <td>${item.quantity}</td>
          <td><strong>${this.money(item.total_ttc)}</strong></td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; background-repeat: no-repeat !important; }
  body { font-family: Arial, sans-serif; color: #071b4d; background: white; }
  .invoice { width: 210mm; background: white; padding: 24px 0; }
  table { width: calc(100% - 48px); margin: 0 24px; border-collapse: separate; border-spacing: 0; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 18px rgba(6,59,136,0.08); overflow: hidden; }
  th { background: #063b88; color: white; padding: 10px 7px; text-align: center; }
  td { padding: 8px 7px; border-bottom: 1px solid #e4ecf5; text-align: center; }
  td:nth-child(2), td:nth-child(3) { text-align: left; }
  tr:last-child td { border-bottom: none; }
  .tva-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: bold; background: #e8f7e5; color: #168a2f; font-size: 11px; }
  .tva-19 { background: #fff0dd; color: #d16600; }
  .tva-0 { background: #f0f0f0; color: #666; }
</style>
</head>
<body>
<div class="invoice">
  <table>
    <thead>
      <tr>
        <th style="width:42px;"></th>
        <th style="text-align:left;">Article</th>
        <th style="text-align:left;">Marque</th>
        <th>Colisage</th>
        <th>Prix Unite</th>
        <th>TVA</th>
        <th>Qte</th>
        <th>Total TTC</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>
</body>
</html>`;
  }

  private showPdfOverlay(): { overlay: HTMLElement; style: HTMLStyleElement } {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pdf-shimmer {
        0%   { background-position: -600px 0; }
        100% { background-position:  600px 0; }
      }
      .ps { background: linear-gradient(90deg, #eef2ff 25%, #dde6ff 50%, #eef2ff 75%);
            background-size: 1200px 100%;
            animation: pdf-shimmer 1.4s infinite linear;
            border-radius: 5px; }
      .ps-warm { background: linear-gradient(90deg, #fffbf0 25%, #ffefc0 50%, #fffbf0 75%);
                 background-size: 1200px 100%;
                 animation: pdf-shimmer 1.4s 0.15s infinite linear;
                 border-radius: 10px; }
    `;
    document.head.appendChild(style);

    const rows = [100, 82, 94, 76, 88]
      .map((w, i) => `<div class="ps" style="width:${w}%;height:10px;animation-delay:${i * 0.08}s"></div>`)
      .join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(4,16,45,0.6)', 'backdrop-filter:blur(8px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:opacity .2s ease',
    ].join(';');

    overlay.innerHTML = `
      <div style="width:460px;background:#fff;border-radius:20px;padding:26px 28px 22px;
                  box-shadow:0 32px 80px rgba(0,0,0,0.4);font-family:Arial,sans-serif">

        <!-- Header row -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <div class="ps" style="width:110px;height:20px"></div>
          <div class="ps" style="width:56px;height:56px;border-radius:50%"></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <div class="ps" style="width:72px;height:12px"></div>
            <div class="ps" style="width:56px;height:12px;animation-delay:.1s"></div>
          </div>
        </div>

        <!-- Blue bar -->
        <div class="ps" style="width:100%;height:22px;border-radius:6px;margin-bottom:16px"></div>

        <!-- Two info cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
          <div class="ps" style="height:82px;border-radius:12px"></div>
          <div class="ps-warm" style="height:82px"></div>
        </div>

        <!-- Table header -->
        <div class="ps" style="width:100%;height:26px;border-radius:7px;margin-bottom:10px"></div>

        <!-- Table rows -->
        <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:18px">${rows}</div>

        <!-- Bottom: amount + summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="ps" style="height:66px;border-radius:10px"></div>
          <div class="ps" style="height:66px;border-radius:10px;animation-delay:.2s"></div>
        </div>

        <!-- Label -->
        <div style="text-align:center;margin-top:20px;color:#8a99b8;font-size:12px;letter-spacing:.4px">
          Génération du PDF en cours…
        </div>
      </div>`;

    document.body.appendChild(overlay);
    return { overlay, style };
  }

  private hidePdfOverlay({ overlay, style }: { overlay: HTMLElement; style: HTMLStyleElement }): void {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.parentNode?.removeChild(overlay);
      style.parentNode?.removeChild(style);
    }, 200);
  }

  private makeIframe(width: number, height = 1): HTMLIFrameElement {
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;top:0;left:-9999px;width:${width}px;height:${height}px;border:none;`;
    document.body.appendChild(f);
    return f;
  }

  private async canvasFromIframe(f: HTMLIFrameElement, width: number): Promise<HTMLCanvasElement> {
    const el = f.contentDocument!.querySelector('.invoice') as HTMLElement;
    return html2canvas(el, { scale: 1.5, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', windowWidth: width });
  }

  async generateFacturePdf(facture: Facturation, company: CompanySettings, mode: 'download' | 'print' | 'preview' = 'print'): Promise<void> {
    const overlayRef = this.showPdfOverlay();
    try {
      if (this.logoCache === undefined) {
        this.logoCache = await this.loadImageAsDataUrl('/logo.png');
      }
      const [imageDataUrls, logoDataUrl] = await Promise.all([
        Promise.all(facture.items.map(item =>
          item.image_url ? this.loadImageAsDataUrl(item.image_url) : Promise.resolve(null)
        )),
        Promise.resolve(this.logoCache),
      ]);

      const W = 794;
      const A4_PX = Math.round(W * 297 / 210); // ≈ 1123 CSS px

      // ── Step 1: Render full doc to measure section heights ──
      const mf = this.makeIframe(W);
      mf.contentDocument!.open();
      mf.contentDocument!.write(this.buildHtml(facture, company, imageDataUrls, logoDataUrl));
      mf.contentDocument!.close();
      await new Promise(r => setTimeout(r, 150));

      const md   = mf.contentDocument!;
      const inv  = md.querySelector('.invoice') as HTMLElement;
      mf.style.height = inv.scrollHeight + 'px';

      // Use getBoundingClientRect so CSS margins are included in the positions
      const invTop      = inv.getBoundingClientRect().top;
      const tbodyEl     = md.querySelector('tbody') as HTMLElement;
      const bottomEl    = md.querySelector('.bottom') as HTMLElement;

      // Distance from invoice top to where rows start
      const tbodyTopPx  = tbodyEl.getBoundingClientRect().top - invTop;
      // Space the summary needs: its rendered height + its 18px CSS margin-top
      const summaryPx   = bottomEl.getBoundingClientRect().height + 18;

      const availForRows = A4_PX - tbodyTopPx - summaryPx - 20 - 16; // 20px bottom padding + 16px buffer

      const trs = md.querySelectorAll('tbody tr');
      let cutoff = trs.length;
      let rowSum = 0;
      for (let i = 0; i < trs.length; i++) {
        const rh = (trs[i] as HTMLElement).getBoundingClientRect().height;
        if (rowSum + rh > availForRows) { cutoff = i; break; }
        rowSum += rh;
      }
      document.body.removeChild(mf);

      // ── Step 2: Render page 1 ───────────────────────────────
      const hasOverflow  = cutoff < facture.items.length;
      const p1Items = facture.items.slice(0, cutoff);
      const p1Imgs  = imageDataUrls.slice(0, cutoff);

      // Estimate total pages
      const avgRowH = cutoff > 0 ? rowSum / cutoff : 42;
      const contAvail = A4_PX - 80; // continuation: table header + padding
      const contPerPage = Math.max(1, Math.floor(contAvail / avgRowH));
      const contCount = facture.items.length - cutoff;
      const totalPages = 1 + (hasOverflow ? Math.ceil(contCount / contPerPage) : 0);

      const p1f = this.makeIframe(W, hasOverflow ? A4_PX : 1);
      p1f.contentDocument!.open();
      p1f.contentDocument!.write(this.buildHtml(facture, company, p1Imgs, logoDataUrl, p1Items, p1Imgs, hasOverflow, 1, totalPages));
      p1f.contentDocument!.close();
      await new Promise(r => setTimeout(r, 150));

      if (!hasOverflow) {
        const el = p1f.contentDocument!.querySelector('.invoice') as HTMLElement;
        p1f.style.height = el.scrollHeight + 'px';
      }
      const p1c = await this.canvasFromIframe(p1f, W);
      document.body.removeChild(p1f);

      // ── Step 3: Build PDF ───────────────────────────────────
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const p1Hmm = hasOverflow ? 297 : (p1c.height * 210 / p1c.width);
      pdf.addImage(p1c.toDataURL('image/png'), 'PNG', 0, 0, 210, p1Hmm);

      // ── Step 4: Continuation pages ──────────────────────────
      if (hasOverflow) {
        const exItems = facture.items.slice(cutoff);
        const exImgs  = imageDataUrls.slice(cutoff);

        const exf = this.makeIframe(W);
        exf.contentDocument!.open();
        exf.contentDocument!.write(this.buildContinuationHtml(exImgs, exItems));
        exf.contentDocument!.close();
        await new Promise(r => setTimeout(r, 150));

        const exEl = exf.contentDocument!.querySelector('.invoice') as HTMLElement;
        exf.style.height = exEl.scrollHeight + 'px';
        const exc = await this.canvasFromIframe(exf, W);
        document.body.removeChild(exf);

        const pageHpx = Math.round(exc.width * 297 / 210);
        let off = 0;
        let contPageIdx = 2;
        while (off < exc.height) {
          const sh = Math.min(pageHpx, exc.height - off);
          const sc = document.createElement('canvas');
          sc.width = exc.width; sc.height = sh;
          const sctx = sc.getContext('2d')!;
          sctx.drawImage(exc, 0, -off);
          // Draw page number bottom-right
          sctx.font = 'bold 22px Arial';
          sctx.fillStyle = '#8a99b8';
          sctx.textAlign = 'right';
          sctx.fillText(`Page ${contPageIdx} / ${totalPages}`, sc.width - 48, sc.height - 28);
          pdf.addPage();
          pdf.addImage(sc.toDataURL('image/png'), 'PNG', 0, 0, 210, sh * 210 / exc.width);
          off += pageHpx;
          contPageIdx++;
        }
      }

      // ── Step 5: Output ──────────────────────────────────────
      if (mode === 'download') {
        pdf.save(`facture-${facture.reference}.pdf`);
        this.toast.showSuccess('Facture téléchargée');
      } else if (mode === 'preview') {
        const blob = pdf.output('blob');
        const url  = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
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
      }
    } catch (err: any) {
      this.toast.showError('PDF error: ' + (err?.message ?? String(err)));
    } finally {
      this.hidePdfOverlay(overlayRef);
    }
  }
}
