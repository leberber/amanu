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

  generateFacturePdf(facture: Facturation, company: CompanySettings, download = false): void {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - 2 * margin;

      // ─── Colors ───────────────────────────────────────────────────────────────
      const darkGray: [number, number, number] = [30, 30, 30];
      const midGray: [number, number, number] = [100, 100, 100];
      const lightGray: [number, number, number] = [220, 220, 220];
      const accent: [number, number, number] = [34, 85, 153];  // professional blue
      const accentLight: [number, number, number] = [235, 241, 253];

      // ─── Header band ──────────────────────────────────────────────────────────
      doc.setFillColor(...accent);
      doc.rect(0, 0, pageWidth, 32, 'F');

      // Logo (top-right in header)
      if (this.logoImage) {
        const logoH = 14;
        const aspectRatio = this.logoImage.width / this.logoImage.height;
        const logoW = logoH * aspectRatio;
        doc.addImage(this.logoImage, 'PNG', pageWidth - margin - logoW, 9, logoW, logoH);
      }

      // FACTURE label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('FACTURE', margin, 18);

      // Reference + Date in header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ref: ${facture.reference}    Date: ${this.dateService.formatDateOnly(facture.created_at)}`, margin, 26);

      // ─── Company info (left block) ────────────────────────────────────────────
      let y = 40;
      const colLeft = margin;
      const colRight = pageWidth / 2 + 4;
      const blockWidth = contentWidth / 2 - 4;

      // Company block label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...midGray);
      doc.text('VENDEUR', colLeft, y);

      // Company name
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      doc.text(this.normalizeText(company.name), colLeft, y);

      // Company details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...midGray);
      if (company.activity) { y += 4; doc.text(this.normalizeText(company.activity), colLeft, y); }
      if (company.address)  { y += 4; doc.text(this.normalizeText(company.address),  colLeft, y); }
      if (company.phone)    { y += 4; doc.text(`Tel: ${company.phone}`,               colLeft, y); }

      // Fiscal identifiers
      doc.setTextColor(...darkGray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      let fiscY = 40 + 5 + 4 + 4; // align with first detail line
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
      const clientBlockTop = 38;
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

      const tableRows = facture.items.map((item, i) => [
        (i + 1).toString(),
        this.normalizeText(item.reference) || '—',
        this.normalizeText(item.product_name),
        item.unit,
        item.quantity.toString(),
        this.formatAmount(item.unit_price),
        `${item.tva_rate}%`,
        this.formatAmount(item.total_ht),
        this.formatAmount(item.total_ttc),
      ]);

      autoTable(doc, {
        startY: tableTop,
        head: [[
          { content: 'N°',  styles: { halign: 'center' } },
          { content: 'Ref', styles: { halign: 'left'   } },
          { content: 'Désignation', styles: { halign: 'left' } },
          { content: 'U',   styles: { halign: 'center' } },
          { content: 'Qté', styles: { halign: 'center' } },
          { content: 'P.U TTC', styles: { halign: 'right' } },
          { content: 'TVA', styles: { halign: 'center' } },
          { content: 'M.T HT', styles: { halign: 'right' } },
          { content: 'M.T TTC', styles: { halign: 'right' } },
        ]],
        body: tableRows,
        theme: 'plain',
        headStyles: {
          fillColor: accent,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 3
        },
        bodyStyles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          textColor: [...darkGray]
        },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        columnStyles: {
          0: { cellWidth: 9,  halign: 'center' },
          1: { cellWidth: 20, halign: 'left'   },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 22, halign: 'right'  },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 22, halign: 'right'  },
          8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 6;

      // ─── Totals block (right-aligned) ─────────────────────────────────────────
      const totWidth = 80;
      const totX = pageWidth - margin - totWidth;

      const totRows: [string, string, boolean][] = [
        ['Total HT',   this.formatAmount(facture.total_ht),  false],
        ['Total TVA',  this.formatAmount(facture.total_tva), false],
        ['Remise',    `-${this.formatAmount(facture.remise)}`, false],
        ['Timbre',     this.formatAmount(facture.timbre),    false],
        ['TOTAL TTC',  this.formatAmount(facture.total_ttc), true ],
      ];

      doc.setLineWidth(0.2);
      doc.setDrawColor(...lightGray);

      totRows.forEach(([label, value, isBold]) => {
        if (isBold) {
          doc.setFillColor(...accent);
          doc.rect(totX, finalY - 4, totWidth, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.text(label, totX + 4, finalY + 1);
          doc.text(`${value} DA`, pageWidth - margin - 2, finalY + 1, { align: 'right' });
          finalY += 10;
        } else {
          doc.setTextColor(...darkGray);
          doc.setFont('helvetica', isBold ? 'bold' : 'normal');
          doc.setFontSize(8.5);
          doc.text(label, totX + 4, finalY);
          doc.text(`${value} DA`, pageWidth - margin - 2, finalY, { align: 'right' });
          doc.line(totX, finalY + 1.5, pageWidth - margin, finalY + 1.5);
          finalY += 6;
        }
      });

      // ─── Payment mode ─────────────────────────────────────────────────────────
      finalY += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...midGray);
      const modeLabel = facture.payment_mode === 'cheque' ? 'Chèque'
        : facture.payment_mode === 'virement' ? 'Virement bancaire'
        : 'Espèces';
      doc.text(`Mode de règlement: ${modeLabel}`, margin, finalY);

      // Notes
      if (facture.notes) {
        finalY += 6;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...midGray);
        doc.text(`Note: ${this.normalizeText(facture.notes)}`, margin, finalY);
      }

      // ─── Footer ───────────────────────────────────────────────────────────────
      doc.setDrawColor(...lightGray);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...midGray);
      doc.text('Document généré automatiquement', pageWidth / 2, pageHeight - 7, { align: 'center' });

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
