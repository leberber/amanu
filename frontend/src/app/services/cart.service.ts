// src/app/services/cart.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Product } from '../models/product.model';
import { AppliedPromotion } from '../models/promotion.model';
import { STORAGE_KEYS } from '../core/constants/app.constants';

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
  pieces_per_box?: number;  // Number of pieces per box
  packaging_type?: string;  // Type of packaging (carton, box, pack, etc.)
  category_id?: number;  // For promotion scope calculation
  brand_id?: number;  // For promotion scope calculation
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = STORAGE_KEYS.CART;
  private readonly PROMO_STORAGE_KEY = STORAGE_KEYS.CART_PROMO;
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  private appliedPromotionSubject = new BehaviorSubject<AppliedPromotion | null>(null);

  public cartItems$ = this.cartItemsSubject.asObservable();
  public appliedPromotion$ = this.appliedPromotionSubject.asObservable();

  // Signal-based cart items for reactive UI updates
  private _cartItems = signal<CartItem[]>([]);
  readonly cartItemsSignal = this._cartItems.asReadonly();

  constructor() {
    // Load cart and promotion from localStorage on service initialization
    this.loadCartFromStorage();
    this.loadPromotionFromStorage();
  }

  private loadCartFromStorage(): void {
    const savedCart = localStorage.getItem(this.STORAGE_KEY);
    if (savedCart) {
      try {
        const cartItems: CartItem[] = JSON.parse(savedCart);
        this.cartItemsSubject.next(cartItems);
        this._cartItems.set(cartItems);
      } catch (e) {
        console.error('Error parsing cart from localStorage:', e);
        this.cartItemsSubject.next([]);
        this._cartItems.set([]);
      }
    }
  }

  private loadPromotionFromStorage(): void {
    const savedPromo = localStorage.getItem(this.PROMO_STORAGE_KEY);
    if (savedPromo) {
      try {
        const promotion: AppliedPromotion = JSON.parse(savedPromo);
        this.appliedPromotionSubject.next(promotion);
      } catch (e) {
        console.error('Error parsing promotion from localStorage:', e);
        this.appliedPromotionSubject.next(null);
      }
    }
  }

  private saveCartToStorage(cartItems: CartItem[]): void {
    // Update the BehaviorSubject first for immediate UI update
    this.cartItemsSubject.next(cartItems);
    // Update the signal for reactive UI
    this._cartItems.set(cartItems);
    // Then save to localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cartItems));
  }

  private savePromotionToStorage(promotion: AppliedPromotion | null): void {
    this.appliedPromotionSubject.next(promotion);
    if (promotion) {
      localStorage.setItem(this.PROMO_STORAGE_KEY, JSON.stringify(promotion));
    } else {
      localStorage.removeItem(this.PROMO_STORAGE_KEY);
    }
  }

  getCartItems(): Observable<CartItem[]> {
    // Return the current cart items as an observable
    return of(this.cartItemsSubject.value);
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
        pieces_per_box: product.pieces_per_box,
        packaging_type: product.packaging_type
      };
      currentCart.push(updatedItem);
    }

    this.saveCartToStorage(currentCart);

    // Return the added/updated item
    return of(updatedItem);
  }

  // Set cart quantity (replaces existing quantity instead of adding)
  setCartQuantity(product: Product, quantity: number): Observable<CartItem> {
    if (!product || !product.id) {
      return throwError(() => new Error('Invalid product'));
    }

    if (quantity < 1) {
      return throwError(() => new Error('Quantity must be at least 1'));
    }

    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) {
      return throwError(() => new Error('Insufficient stock'));
    }

    const currentCart = [...this.cartItemsSubject.value];
    const existingItemIndex = currentCart.findIndex(item => item.product_id === product.id);

    let updatedItem: CartItem;

    if (existingItemIndex !== -1) {
      // Update existing item - SET quantity (not add)
      updatedItem = {
        ...currentCart[existingItemIndex],
        quantity: quantity
      };
      currentCart[existingItemIndex] = updatedItem;
    } else {
      // Add new item
      updatedItem = {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        product_unit: product.unit,
        product_image: product.image_url,
        is_organic: product.is_organic,
        stock_quantity: product.stock_quantity,
        quantity: quantity,
        pieces_per_box: product.pieces_per_box,
        packaging_type: product.packaging_type
      };
      currentCart.push(updatedItem);
    }

    this.saveCartToStorage(currentCart);
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

  // Promotion methods
  applyPromotion(appliedPromotion: AppliedPromotion): void {
    this.savePromotionToStorage(appliedPromotion);
  }

  removePromotion(): void {
    this.savePromotionToStorage(null);
  }

  getAppliedPromotion(): AppliedPromotion | null {
    return this.appliedPromotionSubject.value;
  }

  get discountAmount(): number {
    const promo = this.appliedPromotionSubject.value;
    return promo ? promo.discount_amount : 0;
  }

  get finalTotal(): number {
    return Math.max(0, this.cartTotal - this.discountAmount);
  }

  // Override clearCart to also clear promotion
  clearCartAndPromotion(): Observable<void> {
    this.saveCartToStorage([]);
    this.savePromotionToStorage(null);
    return of(void 0);
  }
}
