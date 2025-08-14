// src/app/services/cart.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Product, QuantityConfig } from '../models/product.model';

export interface CartItem {
  id: string;
  product_id: number;
  product_name: string;
  product_price: number;
  product_unit: string;
  product_image?: string;
  is_organic?: boolean;
  quantity: number;
  stock_quantity?: number;  // To check stock level at checkout
  quantity_config?: QuantityConfig;  // Product quantity configuration
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private STORAGE_KEY = 'fresh_produce_cart';
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();
  
  constructor() {
    // Load cart from localStorage on service initialization
    this.loadCartFromStorage();
  }
  
  private loadCartFromStorage(): void {
    const savedCart = localStorage.getItem(this.STORAGE_KEY);
    if (savedCart) {
      try {
        const cartItems: CartItem[] = JSON.parse(savedCart);
        this.cartItemsSubject.next(cartItems);
      } catch (e) {
        console.error('Error parsing cart from localStorage:', e);
        this.cartItemsSubject.next([]);
      }
    }
  }
  
  private saveCartToStorage(cartItems: CartItem[]): void {
    // Update the BehaviorSubject first for immediate UI update
    this.cartItemsSubject.next(cartItems);
    // Then save to localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cartItems));
  }
  
  getCartItems(): CartItem[] {
    // Return the current cart items directly for better performance
    return this.cartItemsSubject.value;
  }

  getProductQuantityInCart(productId: number): number {
    const item = this.cartItemsSubject.value.find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  }

  isProductInCart(productId: number): boolean {
    return this.cartItemsSubject.value.some(item => item.product_id === productId);
  }
  
  addToCart(product: Product, quantity: number): Observable<CartItem> {
    // Validate inputs
    if (!product || !product.id) {
      return throwError(() => new Error('Invalid product'));
    }
    
    if (quantity < 1) {
      return throwError(() => new Error('Quantity must be at least 1'));
    }
    
    // Check stock availability
    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) {
      return throwError(() => new Error('Insufficient stock'));
    }
    
    const currentCart = [...this.cartItemsSubject.value];
    
    // Check if product already exists in cart
    const existingItemIndex = currentCart.findIndex(item => item.product_id === product.id);
    
    let updatedItem: CartItem;
    
    if (existingItemIndex !== -1) {
      // Update existing item quantity
      const newQuantity = currentCart[existingItemIndex].quantity + quantity;
      
      // Check if new quantity exceeds stock
      if (product.stock_quantity !== undefined && newQuantity > product.stock_quantity) {
        return throwError(() => new Error('Adding this quantity would exceed available stock'));
      }
      
      updatedItem = {
        ...currentCart[existingItemIndex],
        quantity: newQuantity
      };
      currentCart[existingItemIndex] = updatedItem;
    } else {
      // Add new item
      updatedItem = {
        id: Date.now().toString(), // Generate a unique ID based on timestamp
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        product_unit: product.unit,
        product_image: product.image_url,
        is_organic: product.is_organic,
        stock_quantity: product.stock_quantity,
        quantity: quantity,
        quantity_config: product.quantity_config
      };
      currentCart.push(updatedItem);
    }
    
    this.saveCartToStorage(currentCart);
    
    // Return the added/updated item
    return of(updatedItem);
  }
  
  updateCartItem(itemId: string, quantity: number): Observable<CartItem> {
    // Validate inputs
    if (!itemId) {
      return throwError(() => new Error('Invalid item ID'));
    }
    
    if (quantity < 1) {
      return throwError(() => new Error('Quantity must be at least 1'));
    }
    
    const currentCart = [...this.cartItemsSubject.value];
    const itemIndex = currentCart.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return throwError(() => new Error('Item not found in cart'));
    }
    
    // Check stock availability
    const item = currentCart[itemIndex];
    if (item.stock_quantity !== undefined && quantity > item.stock_quantity) {
      return throwError(() => new Error('Quantity exceeds available stock'));
    }
    
    currentCart[itemIndex] = {
      ...currentCart[itemIndex],
      quantity
    };
    
    this.saveCartToStorage(currentCart);
    return of(currentCart[itemIndex]);
  }
  
  removeCartItem(itemId: string): Observable<void> {
    // Validate input
    if (!itemId) {
      return throwError(() => new Error('Invalid item ID'));
    }
    
    const currentCart = this.cartItemsSubject.value;
    const itemExists = currentCart.some(item => item.id === itemId);
    
    if (!itemExists) {
      return throwError(() => new Error('Item not found in cart'));
    }
    
    const updatedCart = currentCart.filter(item => item.id !== itemId);
    
    this.saveCartToStorage(updatedCart);
    return of(void 0);
  }
  
  clearCart(): Observable<void> {
    this.saveCartToStorage([]);
    return of(void 0);
  }
  
  get cartCount(): number {
    return this.cartItemsSubject.value.reduce((count, item) => count + item.quantity, 0);
  }
  
  get cartTotal(): number {
    return this.cartItemsSubject.value.reduce((total, item) => 
      total + (item.product_price * item.quantity), 0);
  }
}