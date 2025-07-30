import { Injectable } from '@angular/core';

export interface TableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  style?: string;
  class?: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'status' | 'actions';
}

/**
 * Simple service to centralize table column configurations
 * Helps maintain consistent table layouts across admin panels
 */
@Injectable({
  providedIn: 'root'
})
export class TableColumnsService {
  
  /**
   * Get product table columns
   */
  getProductColumns(): TableColumn[] {
    return [
      { field: 'id', header: 'admin.products.table.id', sortable: true, style: 'width: 60px' },
      { field: 'name', header: 'admin.products.table.name', sortable: true, style: 'min-width: 200px', class: 'p-3' },
      { field: 'category_id', header: 'admin.products.table.category', sortable: true, style: 'min-width: 120px' },
      { field: 'price', header: 'admin.products.table.price', sortable: true, style: 'min-width: 100px', class: 'text-right', type: 'currency' },
      { field: 'stock_quantity', header: 'admin.products.table.stock', sortable: true, style: 'min-width: 120px', class: 'text-center', type: 'status' },
      { field: 'is_active', header: 'admin.products.table.status', sortable: true, style: 'min-width: 100px', class: 'text-center', type: 'boolean' },
      { field: 'actions', header: 'admin.products.table.actions', sortable: false, style: 'width: 200px', class: 'text-center', type: 'actions' }
    ];
  }

  /**
   * Get category table columns
   */
  getCategoryColumns(): TableColumn[] {
    return [
      { field: 'id', header: 'admin.categories.table.id', sortable: true, style: 'width: 60px' },
      { field: 'name', header: 'admin.categories.table.name', sortable: true, style: 'min-width: 200px' },
      { field: 'product_count', header: 'admin.categories.table.products', sortable: true, style: 'min-width: 120px', class: 'text-center', type: 'number' },
      { field: 'is_active', header: 'admin.categories.table.status', sortable: true, style: 'min-width: 100px', class: 'text-center', type: 'boolean' },
      { field: 'created_at', header: 'admin.categories.table.created', sortable: true, style: 'min-width: 150px', type: 'date' },
      { field: 'actions', header: 'admin.categories.table.actions', sortable: false, style: 'width: 180px', class: 'text-center', type: 'actions' }
    ];
  }

  /**
   * Get order table columns
   */
  getOrderColumns(): TableColumn[] {
    return [
      { field: 'id', header: 'admin.orders.table.order_number', sortable: true, style: 'width: 100px' },
      { field: 'user_id', header: 'admin.orders.table.customer', sortable: true, style: 'min-width: 150px' },
      { field: 'status', header: 'admin.orders.table.status', sortable: true, style: 'min-width: 120px', class: 'text-center', type: 'status' },
      { field: 'total_amount', header: 'admin.orders.table.total', sortable: true, style: 'min-width: 120px', class: 'text-right', type: 'currency' },
      { field: 'created_at', header: 'admin.orders.table.date', sortable: true, style: 'min-width: 150px', type: 'date' },
      { field: 'actions', header: 'admin.orders.table.actions', sortable: false, style: 'width: 180px', class: 'text-center', type: 'actions' }
    ];
  }

  /**
   * Get user table columns
   */
  getUserColumns(): TableColumn[] {
    return [
      { field: 'id', header: 'admin.users.table.id', sortable: true, style: 'width: 60px' },
      { field: 'full_name', header: 'admin.users.table.name', sortable: true, style: 'min-width: 150px' },
      { field: 'email', header: 'admin.users.table.email', sortable: true, style: 'min-width: 200px' },
      { field: 'role', header: 'admin.users.table.role', sortable: true, style: 'min-width: 100px', class: 'text-center', type: 'status' },
      { field: 'is_active', header: 'admin.users.table.status', sortable: true, style: 'min-width: 100px', class: 'text-center', type: 'boolean' },
      { field: 'created_at', header: 'admin.users.table.joined', sortable: true, style: 'min-width: 150px', type: 'date' },
      { field: 'actions', header: 'admin.users.table.actions', sortable: false, style: 'width: 180px', class: 'text-center', type: 'actions' }
    ];
  }

  /**
   * Get standard pagination options
   */
  getPaginationOptions(): number[] {
    return [10, 25, 50, 100];
  }
}