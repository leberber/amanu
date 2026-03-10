import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CartItem } from './cart.service';
import { OrderCreate, OrderCreateItem, Order, OrderItem } from '../models/order.model';
import { ORDER_STATUS } from '../core/constants/order.constants';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private apiService: ApiService) {}

  createOrder(orderData: OrderCreate): Observable<Order> {
    return this.apiService.post<Order>('/orders', orderData);
  }

  getUserOrders(): Observable<Order[]> {
    return this.apiService.get<Order[]>('/orders');
  }

  getOrderDetails(orderId: number): Observable<Order> {
    return this.apiService.get<Order>(`/orders/${orderId}`).pipe(
      map(order => {
        // Ensure the items property exists
        if (!order.items) {
          order.items = [];
        }

        // If items is not an array, convert it to one
        if (order.items && !Array.isArray(order.items)) {
          order.items = Object.values(order.items);
        }

        return order;
      })
    );
  }

  cancelOrder(orderId: number): Observable<Order> {
    return this.apiService.patch<Order>(`/orders/${orderId}`, {
      status: ORDER_STATUS.CANCELLED
    });
  }

  // Helper method to convert cart items to order items
  cartItemsToOrderItems(cartItems: CartItem[]): OrderCreateItem[] {
    return cartItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }));
  }
}