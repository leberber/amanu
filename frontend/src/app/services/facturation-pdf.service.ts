import { Injectable, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { CompanySettings, Facturation } from '../core/services/facturation.service';
import { ToastMessageService } from '../core/services/toast-message.service';
import { DateService } from '../core/services/date.service';

@Injectable({
  providedIn: 'root'
})
export class FacturationPdfService {
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastMessageService);
  private dateService = inject(DateService);

  pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  showPdfPreview = signal(false);
  pdfDoc = signal<jsPDF | null>(null);

  private pdfBlobUrl: string | null = null;
  private logoImage: HTMLImageElement | null = null;

  constructor() {
    this.loadLogo();
  }

  private loadLogo(): void {
    const img = new Image();
    img.src = 'logo.png';
    img.onload = () => { this.logoImage = img; };
  }

  private normalizeText(text: string | undefined | null): string {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private formatAmount(value: number): string {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  closePdfPreview(): void {
    this.showPdfPreview.set(false);
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.pdfDoc.set(null);
  }

  downloadPdf(reference: string): void {
    const doc = this.pdfDoc();
    if (doc) {
      doc.save(`facture-${reference}.pdf`);
      this.toast.showSuccess('Facture téléchargée');
      this.closePdfPreview();
    }
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async generateFacturePdf(facture: Facturation, company: CompanySettings, download = false): Promise<void> {
    try {
      // ─── Pre-load product images ───────────────────────────────────────────────
      const imageMap: { [productId: number]: string } = {};
      await Promise.all(
        facture.items
          .filter(item => item.product_id && item.image_url)
          .map(async item => {
            const dataUrl = await this.loadImageAsDataUrl(item.image_url!);
            if (dataUrl && item.product_id) imageMap[item.product_id] = dataUrl;
          })
      );

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - 2 * margin;

      // ─── Colors ───────────────────────────────────────────────────────────────
      const darkGray: [number, number, number] = [30, 30, 30];
      const midGray: [number, number, number] = [100, 100, 100];
      const lightGray: [number, number, number] = [220, 220, 220];
      const accent: [number, number, number] = [34, 85, 153];
      const accentLight: [number, number, number] = [235, 241, 253];

      const modeLabel = facture.payment_mode === 'cheque' ? 'Cheque'
        : facture.payment_mode === 'virement' ? 'Virement bancaire'
        : 'Especes';

      // ─── Header band ──────────────────────────────────────────────────────────
      doc.setFillColor(...accent);
      doc.rect(0, 0, pageWidth, 34, 'F');

      if (this.logoImage) {
        const logoH = 14;
        const aspectRatio = this.logoImage.width / this.logoImage.height;
        const logoW = logoH * aspectRatio;
        doc.addImage(this.logoImage, 'PNG', pageWidth - margin - logoW, 10, logoW, logoH);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('FACTURE', margin, 17);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${facture.reference}   |   ${this.dateService.formatDateOnly(facture.created_at)}   |   Reglement: ${modeLabel}`,
        margin, 26
      );

      // ─── Company info (left block) ────────────────────────────────────────────
      let y = 42;
      const colLeft = margin;
      const colRight = pageWidth / 2 + 4;
      const blockWidth = contentWidth / 2 - 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...midGray);
      doc.text('VENDEUR', colLeft, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.text(this.normalizeText(company.name), colLeft, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...midGray);
      if (company.activity) { y += 4; doc.text(this.normalizeText(company.activity), colLeft, y); }
      if (company.address)  { y += 4; doc.text(this.normalizeText(company.address),  colLeft, y); }
      if (company.phone)    { y += 4; doc.text(`Tel: ${company.phone}`,               colLeft, y); }

      doc.setTextColor(...darkGray);
      doc.setFontSize(7.5);
      let fiscY = 42 + 5 + 4 + 4;
      const identifiers: [string, string | undefined][] = [
        ['RC', company.rc], ['N.A', company.na], ['NIF', company.nif], ['NIS', company.nis]
      ];
      for (const [label, val] of identifiers) {
        if (val) {
          fiscY += 4;
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, colLeft + 1, fiscY);
          doc.setFont('helvetica', 'normal');
          doc.text(val, colLeft + 12, fiscY);
        }
      }

      // ─── Client block (right) ────────────────────────────────────────────────
      const clientBlockTop = 40;
      doc.setFillColor(...accentLight);
      doc.roundedRect(colRight, clientBlockTop, blockWidth, 46, 2, 2, 'F');
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.3);
      doc.roundedRect(colRight, clientBlockTop, blockWidth, 46, 2, 2, 'D');

      let cy = clientBlockTop + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...accent);
      doc.text('CLIENT', colRight + 4, cy);

      cy += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.text(this.normalizeText(facture.client_name), colRight + 4, cy);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...midGray);
      if (facture.client_address) { cy += 4.5; doc.text(this.normalizeText(facture.client_address), colRight + 4, cy); }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkGray);
      const clientIds: [string, string | undefined][] = [
        ['RC', facture.client_rc], ['N.A', facture.client_na],
        ['NIF', facture.client_nif], ['NIS', facture.client_nis]
      ];
      for (const [label, val] of clientIds) {
        if (val) {
          cy += 4;
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, colRight + 4, cy);
          doc.setFont('helvetica', 'normal');
          doc.text(val, colRight + 16, cy);
        }
      }

      // ─── Items table ─────────────────────────────────────────────────────────
      const tableTop = Math.max(y, clientBlockTop + 46) + 8;
      const hasImages = facture.items.some(item => item.product_id && imageMap[item.product_id]);

      const tableRows = facture.items.map((item, i) => {
        const puHt = item.tva_rate > 0 ? item.unit_price / (1 + item.tva_rate / 100) : item.unit_price;
        const prixPcs = item.pieces_per_box > 1 ? this.formatAmount(item.unit_price / item.pieces_per_box) : '—';
        return [
          hasImages ? '' : (i + 1).toString(),
          this.normalizeText(item.product_name),
          prixPcs,
          item.pieces_per_box > 1 ? `${item.pieces_per_box}pcs x ${item.unit}` : item.unit,
          item.quantity.toString(),
          this.formatAmount(puHt),
          `${item.tva_rate}%`,
          this.formatAmount(item.unit_price),
          this.formatAmount(item.total_ttc),
        ];
      });

      autoTable(doc, {
        startY: tableTop,
        head: [[
          { content: hasImages ? '' : 'N°', styles: { halign: 'center' } },
          { content: 'Designation',  styles: { halign: 'left'   } },
          { content: 'Prix/pcs',     styles: { halign: 'right'  } },
          { content: 'Unite/Embal.', styles: { halign: 'left'   } },
          { content: 'Qte',          styles: { halign: 'center' } },
          { content: 'P.U HT',       styles: { halign: 'right'  } },
          { content: 'TVA',          styles: { halign: 'center' } },
          { content: 'P.U TTC',      styles: { halign: 'right'  } },
          { content: 'M.T TTC',      styles: { halign: 'right'  } },
        ]],
        body: tableRows,
        theme: 'plain',
        headStyles: {
          fillColor: accent,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 3.5
        },
        bodyStyles: {
          fontSize: 8.5,
          cellPadding: 3,
          minCellHeight: hasImages ? 14 : 0,
          textColor: [...darkGray]
        },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        margin: { left: 5, right: 5 },
        tableWidth: pageWidth - 10,
        columnStyles: {
          0: { cellWidth: hasImages ? 14 : 9, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 18, halign: 'right'  },
          3: { cellWidth: 28, halign: 'left'   },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 18, halign: 'right'  },
          6: { cellWidth: 10, halign: 'center' },
          7: { cellWidth: 18, halign: 'right'  },
          8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        },
        didDrawCell: (data: any) => {
          if (!hasImages) return;
          if (data.section === 'body' && data.column.index === 0) {
            const item = facture.items[data.row.index];
            if (item?.product_id && imageMap[item.product_id]) {
              const imgSize = Math.min(data.cell.height - 2, 12);
              const x = data.cell.x + (data.cell.width - imgSize) / 2;
              const y = data.cell.y + (data.cell.height - imgSize) / 2;
              try {
                doc.addImage(imageMap[item.product_id], 'JPEG', x, y, imgSize, imgSize);
              } catch { /* skip if image format not supported */ }
            }
          }
        }
      });

      const tableEndY = (doc as any).lastAutoTable.finalY;

      // ─── Totals block — always pinned to bottom of page ───────────────────────
      const totWidth = 80;
      const totX = pageWidth - 5 - totWidth;

      const totRows: [string, string, boolean][] = [
        ['Total HT',  this.formatAmount(facture.total_ht),  false],
        ['Total TVA', this.formatAmount(facture.total_tva), false],
      ];
      if (facture.remise > 0) totRows.push(['Remise', `-${this.formatAmount(facture.remise)}`, false]);
      if (facture.timbre > 0) totRows.push(['Timbre',  this.formatAmount(facture.timbre),      false]);
      totRows.push(['TOTAL TTC', this.formatAmount(facture.total_ttc), true]);

      // Height: each normal row = 6mm, bold row = 10mm
      const totBlockHeight = (totRows.length - 1) * 6 + 10;
      let totY = pageHeight - 12 - 4 - totBlockHeight; // above footer line

      // Notes between table and totals
      if (facture.notes) {
        const notesY = Math.min(tableEndY + 8, totY - 10);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...midGray);
        doc.text(`Note: ${this.normalizeText(facture.notes)}`, margin, notesY);
      }

      doc.setLineWidth(0.2);
      doc.setDrawColor(...lightGray);

      totRows.forEach(([label, value, isBold]) => {
        if (isBold) {
          doc.setFillColor(...accent);
          doc.rect(totX, totY - 4, totWidth, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.text(label, totX + 4, totY + 1);
          doc.text(`${value} DA`, pageWidth - 5 - 2, totY + 1, { align: 'right' });
          totY += 10;
        } else {
          doc.setTextColor(...darkGray);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text(label, totX + 4, totY);
          doc.text(`${value} DA`, pageWidth - 5 - 2, totY, { align: 'right' });
          doc.line(totX, totY + 1.5, pageWidth - 5, totY + 1.5);
          totY += 6;
        }
      });

      // ─── Footer ───────────────────────────────────────────────────────────────
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...midGray);
      doc.text('Document genere automatiquement', pageWidth / 2, pageHeight - 7, { align: 'center' });

      // Output
      if (download) {
        doc.save(`facture-${facture.reference}.pdf`);
        this.toast.showSuccess('Facture téléchargée');
      } else {
        this.pdfDoc.set(doc);
        const blob = doc.output('blob');
        this.pdfBlobUrl = URL.createObjectURL(blob);
        this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl));
        this.showPdfPreview.set(true);
      }
    } catch {
      this.toast.showError('Erreur lors de la génération de la facture PDF');
    }
  }
}
