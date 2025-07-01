// src/app/pages/admin/admin-dashboard/admin-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AdminService } from '../../../services/admin.service'; 
import { DashboardStats } from '../../../models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    ToastModule,
    ChartModule,
    TagModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  salesChartData: any;
  salesChartOptions: any;
  categoryChartData: any;
  categoryChartOptions: any;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadDashboardStats();
  }

  loadDashboardStats() {
    this.loading = true;
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
        this.prepareChartData();
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.loading = false;
        
        let errorMessage = 'Failed to load dashboard statistics';
        if (error.status === 403) {
          errorMessage = 'You do not have permission to access this page';
          this.router.navigate(['/']);
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage
        });
      }
    });
  }

  prepareChartData() {
    if (!this.stats) return;

    // Sales by category chart
    const categoryLabels = this.stats.sales_by_category.map(item => item.name);
    const categorySales = this.stats.sales_by_category.map(item => item.total_sales);
    
    this.categoryChartData = {
      labels: categoryLabels,
      datasets: [
        {
          label: 'Sales by Category',
          data: categorySales,
          backgroundColor: [
            '#42A5F5', '#66BB6A', '#FFA726', '#26C6DA', '#7E57C2', 
            '#EC407A', '#AB47BC', '#5C6BC0', '#29B6F6', '#26A69A'
          ],
          hoverBackgroundColor: [
            '#64B5F6', '#81C784', '#FFB74D', '#4DD0E1', '#9575CD', 
            '#F06292', '#BA68C8', '#7986CB', '#4FC3F7', '#4DB6AC'
          ]
        }
      ]
    };
    
    this.categoryChartOptions = {
      plugins: {
        legend: {
          position: 'right'
        }
      }
    };
  }

  getStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    switch (status) {
      case 'pending': return 'warn';     // Changed from 'warning' to 'warn'
      case 'confirmed': return 'info';
      case 'shipped': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  navigateToOrders() {
    this.router.navigate(['/admin/orders']);
  }

  navigateToUsers() {
    this.router.navigate(['/admin/users']);
  }

  navigateToProducts() {
    this.router.navigate(['/admin/products']);
  }
}