import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Order } from '../models/admin.model';
import { ToastMessageService } from '../core/services/toast-message.service';

@Injectable({
  providedIn: 'root'
})
export class OrderPdfService {
  private toast = inject(ToastMessageService);
  private logoImage: HTMLImageElement | null = null;

  constructor() {
    this.loadLogo();
  }

  private loadLogo(): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'logo.png';
    img.onload = () => {
      this.logoImage = img;
    };
  }

  private formatNumber(value: number): string {
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private normalizeText(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Load an image as base64 data URL using fetch with cache bypass to avoid CORS issues.
   */
  private async loadImage(url: string): Promise<string | null> {
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

  /**
   * Generate and download order PDF
   */
  async generateOrderPdf(order: Order): Promise<void> {
    if (!order.items || order.items.length === 0) {
      this.toast.showWarn('La commande est vide');
      return;
    }

    try {
      // Preload product images
      const imagePromises = order.items.map(item =>
        item.image_url ? this.loadImage(item.image_url) : Promise.resolve(null)
      );
      const images = await Promise.all(imagePromises);

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
      doc.text(`COMMANDE #${order.id}`, margin, 14);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(this.formatDate(order.created_at), margin, 20);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 24, pageWidth - margin, 24);

      // ===== CUSTOMER INFO =====
      let yPosition = 30;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('CLIENT', margin, yPosition);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const customerName = order.user?.full_name || `Utilisateur #${order.user_id}`;
      doc.text(this.normalizeText(customerName), margin, yPosition + 5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      let infoY = yPosition + 10;

      if (order.contact_phone) {
        doc.text(`Tel: ${order.contact_phone}`, margin, infoY);
        infoY += 4;
      }
      if (order.shipping_address) {
        doc.text(this.normalizeText(order.shipping_address), margin, infoY);
      }

      // Status on the right side
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('STATUT', pageWidth - margin - 30, yPosition);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(this.getStatusLabel(order.status), pageWidth - margin - 30, yPosition + 5);

      yPosition += 24;

      // ===== PRODUCTS TABLE =====
      const imgSize = 14;
      const tableData = order.items.map((item) => {
        const piecesPerBox = item.pieces_per_box || 1;
        const cartons = piecesPerBox > 1 ? Math.round(item.quantity / piecesPerBox) : '';
        return [
          '',
          this.normalizeText(item.product_name),
          cartons.toString(),
          item.quantity.toString(),
          `${this.formatNumber(item.unit_price)} DA`,
          `${this.formatNumber(item.unit_price * item.quantity)} DA`
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [[
          { content: '', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'Produit', styles: { halign: 'left' } },
          { content: 'Cartons', styles: { halign: 'center' } },
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
          cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
          textColor: [60, 60, 60],
          minCellHeight: imgSize + 4
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248]
        },
        margin: { left: margin, right: margin },
        tableWidth: pageWidth - 2 * margin,
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 0) {
            const imgDataUrl = images[data.row.index];
            if (imgDataUrl) {
              try {
                doc.addImage(
                  imgDataUrl, 'JPEG',
                  data.cell.x + 2,
                  data.cell.y + 2,
                  imgSize, imgSize
                );
              } catch {
                // Skip image if it fails
              }
            }
          }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 6;

      // ===== TOTALS =====
      const totalsX = pageWidth - margin;

      if (order.discount_amount && order.discount_amount > 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Sous-total: ${this.formatNumber(order.subtotal || order.total_amount + order.discount_amount)} DA`, totalsX, finalY, { align: 'right' });
        finalY += 5;

        doc.setTextColor(220, 50, 50);
        doc.text(`Remise: -${this.formatNumber(order.discount_amount)} DA`, totalsX, finalY, { align: 'right' });
        finalY += 6;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`Total: ${this.formatNumber(order.total_amount)} DA`, totalsX, finalY, { align: 'right' });

      finalY += 6;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${order.items.length} produits`, totalsX, finalY, { align: 'right' });

      // ===== FOOTER =====
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Document genere automatiquement - AgroClik', pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Open print dialog using hidden iframe
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        // Clean up after a delay
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(pdfUrl);
        }, 60000);
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.toast.showError('Erreur lors de la generation du PDF');
    }
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'En attente',
      'confirmed': 'Confirmee',
      'assigned': 'Assignee',
      'picked_up': 'Recuperee',
      'in_transit': 'En transit',
      'delivered': 'Livree',
      'cancelled': 'Annulee'
    };
    return labels[status] || status;
  }
}
