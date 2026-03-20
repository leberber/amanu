import { Injectable, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { RestockRow } from '../models/restock.model';
import { Supplier } from '../models/supplier.model';
import { ToastMessageService } from '../core/services/toast-message.service';

@Injectable({
  providedIn: 'root'
})
export class PurchasingPdfService {
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastMessageService);

  // PDF Preview state
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
    img.onload = () => {
      this.logoImage = img;
    };
  }

  // Format helpers
  private formatNumber(value: number): string {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private normalizeText(text: string): string {
    // Remove accents for PDF compatibility (é → e, è → e, etc.)
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

  downloadPdf(supplierName?: string): void {
    const doc = this.pdfDoc();
    if (doc) {
      const today = new Date().toLocaleDateString('fr-FR');
      const name = supplierName || 'tous';
      doc.save(`bon-de-commande-${name}-${today}.pdf`);
      this.toast.showSuccess('PDF téléchargé avec succès');
      this.closePdfPreview();
    }
  }

  /**
   * Generate a purchase order PDF (Bon de Commande)
   */
  generateBonDeCommande(
    items: RestockRow[],
    supplierInfo: Supplier | { name: string; address?: string; phone?: string; email?: string; city?: string } | undefined,
    supplierKey: string,
    orderRef: string
  ): void {
    if (items.length === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const today = new Date();

      // ===== HEADER =====
      // Logo on the right
      if (this.logoImage) {
        const logoHeight = 12;
        const aspectRatio = this.logoImage.width / this.logoImage.height;
        const logoWidth = logoHeight * aspectRatio;
        doc.addImage(this.logoImage, 'PNG', pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);
      }

      // Document title on the left
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('BON DE COMMANDE', margin, 14);

      // Reference and date below title
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${orderRef}  |  ${this.formatDate(today.toISOString())}`, margin, 20);

      // Thin separator line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 24, pageWidth - margin, 24);

      // ===== SUPPLIER INFO (Left side) =====
      let yPosition = 30;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('FOURNISSEUR', margin, yPosition);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(this.normalizeText(supplierInfo?.name || supplierKey), margin, yPosition + 5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let infoY = yPosition + 10;

      if (supplierInfo?.address) {
        doc.text(this.normalizeText(supplierInfo.address), margin, infoY);
        infoY += 4;
      }
      if (supplierInfo?.city) {
        doc.text(this.normalizeText(supplierInfo.city), margin, infoY);
        infoY += 4;
      }
      if (supplierInfo?.phone) {
        doc.text(`Tel: ${supplierInfo.phone}`, margin, infoY);
      }

      yPosition += 24;

      // ===== PRODUCTS TABLE =====
      const tableData = items.map((row, index) => [
        (index + 1).toString(),
        this.normalizeText(row.name),
        this.normalizeText(row.brand),
        row.uniteParCarton.toString(),
        row.nmbCarton.toString(),
        this.formatNumber(row.prixCarton),
        this.formatNumber(row.prixCarton * row.nmbCarton)
      ]);

      const totalValue = items.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);
      const totalItems = items.reduce((sum, r) => sum + r.nmbCarton, 0);

      autoTable(doc, {
        startY: yPosition,
        head: [[
          { content: '#', styles: { halign: 'center' } },
          { content: 'Designation', styles: { halign: 'left' } },
          { content: 'Marque', styles: { halign: 'left' } },
          { content: 'U/C', styles: { halign: 'center' } },
          { content: 'Qte', styles: { halign: 'center' } },
          { content: 'P.U', styles: { halign: 'right' } },
          { content: 'Total', styles: { halign: 'right' } }
        ]],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [55, 55, 55],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.8,
          textColor: [60, 60, 60]
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248]
        },
        margin: { left: margin, right: margin },
        tableWidth: pageWidth - 2 * margin,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30 },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        }
      });

      // Get final Y position after table
      let finalY = (doc as any).lastAutoTable.finalY + 8;

      // ===== TOTALS (Right aligned) =====
      const totalsX = pageWidth - margin - 50;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${items.length} produits  |  ${totalItems} articles`, totalsX, finalY, { align: 'left' });

      finalY += 6;
      doc.setFillColor(50, 50, 50);
      doc.roundedRect(totalsX - 3, finalY - 4, 53, 10, 2, 2, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', totalsX, finalY + 2);
      doc.text(`${this.formatNumber(totalValue)} DA`, pageWidth - margin - 5, finalY + 2, { align: 'right' });

      // ===== SIGNATURES =====
      finalY += 20;

      if (finalY < pageHeight - 40) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);

        // Left signature
        doc.text('Signature Fournisseur', margin, finalY);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, finalY + 2, 55, 18, 2, 2, 'S');

        // Right signature
        doc.text('Signature Acheteur', pageWidth - margin - 55, finalY);
        doc.roundedRect(pageWidth - margin - 55, finalY + 2, 55, 18, 2, 2, 'S');
      }

      // ===== FOOTER =====
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Document genere automatiquement', pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Show preview
      this.pdfDoc.set(doc);
      const pdfBlob = doc.output('blob');
      this.pdfBlobUrl = URL.createObjectURL(pdfBlob);
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl));
      this.showPdfPreview.set(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.toast.showError('Erreur lors de la génération du PDF');
    }
  }

  /**
   * Generate a temporary reference for preview
   */
  generateTempReference(): string {
    const today = new Date();
    return `BC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-XXX`;
  }

  /**
   * Download cart as PDF with all suppliers grouped
   */
  downloadCartPdf(
    cartGroupedBySupplier: Map<string, RestockRow[]>,
    cartTotalValue: number,
    getSupplierDetails: (name: string) => Supplier | undefined
  ): void {
    if (cartGroupedBySupplier.size === 0) {
      this.toast.showWarn('Le panier est vide');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Bon de Commande', 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${this.formatDate(today.toISOString())}`, 14, 28);

      let yPosition = 40;

      cartGroupedBySupplier.forEach((rows, supplier) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        // Get supplier details
        const supplierInfo = getSupplierDetails(supplier);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Fournisseur: ${this.normalizeText(supplierInfo?.name || supplier)}`, 14, yPosition);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let detailsY = yPosition + 6;

        if (supplierInfo?.address) {
          doc.text(`Adresse: ${this.normalizeText(supplierInfo.address)}${supplierInfo.city ? ', ' + this.normalizeText(supplierInfo.city) : ''}`, 14, detailsY);
          detailsY += 5;
        }

        const phone = supplierInfo?.phone || rows[0]?.phone;
        if (phone) {
          doc.text(`Tel: ${phone}`, 14, detailsY);
          detailsY += 5;
        }

        if (supplierInfo?.email) {
          doc.text(`Email: ${supplierInfo.email}`, 14, detailsY);
          detailsY += 5;
        }

        yPosition = detailsY + 5;

        const tableData = rows.map(row => [
          this.normalizeText(row.name),
          this.normalizeText(row.brand),
          row.nmbCarton.toString(),
          this.formatNumber(row.prixCarton),
          this.formatNumber(row.prixCarton * row.nmbCarton)
        ]);

        const supplierTotal = rows.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0);

        autoTable(doc, {
          startY: yPosition,
          head: [['Produit', 'Marque', 'Qté', 'Prix/Carton', 'Total']],
          body: tableData,
          foot: [['', '', '', 'Total:', this.formatNumber(supplierTotal)]],
          theme: 'plain',
          headStyles: {
            fillColor: [245, 245, 245],
            textColor: [40, 40, 40],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [200, 200, 200]
          },
          bodyStyles: {
            lineWidth: 0.25,
            lineColor: [220, 220, 220]
          },
          footStyles: {
            fillColor: [250, 250, 250],
            textColor: [30, 30, 30],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [200, 200, 200]
          },
          alternateRowStyles: {
            fillColor: [252, 252, 252]
          },
          margin: { left: 14, right: 14 },
          styles: {
            fontSize: 9,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.25
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Général: ${this.formatNumber(cartTotalValue)} DA`, pageWidth - 14, yPosition, { align: 'right' });

      const fileName = `bon_commande_${today.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      this.toast.showSuccess('PDF téléchargé avec succès');
    } catch {
      this.toast.showError('Erreur lors de la génération du PDF');
    }
  }
}
