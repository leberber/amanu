import { Injectable, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { RestockRow } from '../models/restock.model';
import { Supplier } from '../models/supplier.model';
import { PurchaseOrder } from './purchase-order.service';
import { ToastMessageService } from '../core/services/toast-message.service';

// Common data structure for PDF generation
interface PdfOrderData {
  reference: string;
  date: string;
  supplier: {
    name: string;
    address?: string;
    city?: string;
    phone?: string;
  };
  items: {
    name: string;
    brand: string;
    unitsPerCarton: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  totalAmount: number;
}

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
   * Generate a temporary reference for preview
   */
  generateTempReference(): string {
    const today = new Date();
    return `BC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-XXX`;
  }

  // ============================================================================
  // Public methods - convert input to common format and call internal generator
  // ============================================================================

  /**
   * Generate PDF from cart items (RestockRow[])
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

    const data: PdfOrderData = {
      reference: orderRef,
      date: new Date().toISOString(),
      supplier: {
        name: supplierInfo?.name || supplierKey,
        address: supplierInfo?.address,
        city: supplierInfo?.city,
        phone: supplierInfo?.phone
      },
      items: items.map(row => ({
        name: row.name,
        brand: row.brand,
        unitsPerCarton: row.uniteParCarton,
        quantity: row.nmbCarton,
        unitPrice: row.prixCarton,
        totalPrice: row.prixCarton * row.nmbCarton
      })),
      totalAmount: items.reduce((sum, r) => sum + (r.prixCarton * r.nmbCarton), 0)
    };

    this.generatePdfInternal(data, false);
  }

  /**
   * Generate PDF from a saved PurchaseOrder
   */
  generatePurchaseOrderPdf(order: PurchaseOrder, download = false): void {
    if (order.items.length === 0) {
      this.toast.showWarn('La commande est vide');
      return;
    }

    const data: PdfOrderData = {
      reference: order.reference,
      date: order.created_at,
      supplier: {
        name: order.supplier_name,
        address: order.supplier_address,
        city: order.supplier_city,
        phone: order.supplier_phone
      },
      items: order.items.map(item => ({
        name: item.product_name,
        brand: item.brand,
        unitsPerCarton: item.units_per_carton,
        quantity: item.quantity_ordered,
        unitPrice: item.unit_price,
        totalPrice: item.total_price
      })),
      totalAmount: order.total_amount
    };

    this.generatePdfInternal(data, download, order.reference);
  }

  // ============================================================================
  // Internal PDF generation - single source of truth
  // ============================================================================

  private generatePdfInternal(data: PdfOrderData, download: boolean, fileName?: string): void {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      // ===== HEADER =====
      if (this.logoImage) {
        const logoHeight = 12;
        const aspectRatio = this.logoImage.width / this.logoImage.height;
        const logoWidth = logoHeight * aspectRatio;
        doc.addImage(this.logoImage, 'PNG', pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('BON DE COMMANDE', margin, 14);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${data.reference}  |  ${this.formatDate(data.date)}`, margin, 20);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 24, pageWidth - margin, 24);

      // ===== SUPPLIER INFO =====
      let yPosition = 30;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('FOURNISSEUR', margin, yPosition);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(this.normalizeText(data.supplier.name), margin, yPosition + 5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let infoY = yPosition + 10;

      if (data.supplier.address) {
        doc.text(this.normalizeText(data.supplier.address), margin, infoY);
        infoY += 4;
      }
      if (data.supplier.city) {
        doc.text(this.normalizeText(data.supplier.city), margin, infoY);
        infoY += 4;
      }
      if (data.supplier.phone) {
        doc.text(`Tel: ${data.supplier.phone}`, margin, infoY);
      }

      yPosition += 24;

      // ===== PRODUCTS TABLE =====
      const tableData = data.items.map((item, index) => [
        (index + 1).toString(),
        this.normalizeText(item.name),
        this.normalizeText(item.brand),
        item.unitsPerCarton.toString(),
        item.quantity.toString(),
        '',
        ''
      ]);

      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);

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
          fontSize: 9,
          cellPadding: 3
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
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
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 8;

      // ===== TOTALS =====
      const totalsX = pageWidth - margin - 50;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${data.items.length} produits  |  ${totalItems} articles`, totalsX, finalY, { align: 'left' });

      // ===== FOOTER =====
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Document genere automatiquement', pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Output
      if (download) {
        doc.save(`${fileName || data.reference}.pdf`);
        this.toast.showSuccess('PDF telecharge');
      } else {
        this.pdfDoc.set(doc);
        const pdfBlob = doc.output('blob');
        this.pdfBlobUrl = URL.createObjectURL(pdfBlob);
        this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl));
        this.showPdfPreview.set(true);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.toast.showError('Erreur lors de la generation du PDF');
    }
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
            0: { cellWidth: 55 },
            1: { cellWidth: 35 },
            2: { cellWidth: 25, halign: 'center' },
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
