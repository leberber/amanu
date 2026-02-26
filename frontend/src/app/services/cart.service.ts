// src/app/services/cart.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
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
  stock_quantity?: number;
  pieces_per_box?: number;
  packaging_type?: string;
  category_id?: number;
  brand_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = STORAGE_KEYS.CART;
  private readonly PROMO_STORAGE_KEY = STORAGE_KEYS.CART_PROMO;

  // Primary state - signals
  private _items = signal<CartItem[]>([]);
  private _appliedPromotion = signal<AppliedPromotion | null>(null);

  // Public readonly signals for components to use directly
  readonly items = this._items.asReadonly();
  readonly appliedPromotion = this._appliedPromotion.asReadonly();

  // Computed signals for derived values
  readonly itemCount = computed(() => this._items().length);

  readonly totalQuantity = computed(() =>
    this._items().reduce((count, item) => count + item.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this._items().reduce((total, item) => total + (item.product_price * item.quantity), 0)
  );

  readonly discountAmount = computed(() =>
    this._appliedPromotion()?.discount_amount || 0
  );

  readonly finalTotal = computed(() =>
    Math.max(0, this.subtotal() - this.discountAmount())
  );

  constructor() {
    this.loadCartFromStorage();
    this.loadPromotionFromStorage();
  }

  private loadCartFromStorage(): void {
    const savedCart = localStorage.getItem(this.STORAGE_KEY);
    if (savedCart) {
      try {
        const cartItems: CartItem[] = JSON.parse(savedCart);
        this._items.set(cartItems);
      } catch (e) {
        console.error('Error parsing cart from localStorage:', e);
        this._items.set([]);
      }
    }
  }

  private loadPromotionFromStorage(): void {
    const savedPromo = localStorage.getItem(this.PROMO_STORAGE_KEY);
    if (savedPromo) {
      try {
        const promotion: AppliedPromotion = JSON.parse(savedPromo);
        this._appliedPromotion.set(promotion);
      } catch (e) {
        console.error('Error parsing promotion from localStorage:', e);
        this._appliedPromotion.set(null);
      }
    }
  }

  private saveCartToStorage(cartItems: CartItem[]): void {
    this._items.set(cartItems);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cartItems));
  }

  private savePromotionToStorage(promotion: AppliedPromotion | null): void {
    this._appliedPromotion.set(promotion);
    if (promotion) {
      localStorage.setItem(this.PROMO_STORAGE_KEY, JSON.stringify(promotion));
    } else {
      localStorage.removeItem(this.PROMO_STORAGE_KEY);
    }
  }

  // Helper to update items in cart
  updateItems(updater: (items: CartItem[]) => CartItem[]): void {
    const updated = updater([...this._items()]);
    this.saveCartToStorage(updated);
  }

  getCartItems(): Observable<CartItem[]> {
    return of(this._items());
  }

  getProductQuantityInCart(productId: number): number {
    const item = this._items().find(item => item.product_id === productId);
    return item ? item.quantity : 0;
  }

  isProductInCart(productId: number): boolean {
    return this._items().some(item => item.product_id === productId);
  }

  addToCart(product: Product, quantity: number): Observable<CartItem> {
    if (!product || !product.id) {
      return throwError(() => new Error('Invalid product'));
    }

    if (quantity < 1) {
      return throwError(() => new Error('Quantity must be at least 1'));
    }

    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) {
      return throwError(() => new Error('Insufficient stock'));
    }

    const currentCart = [...this._items()];
    const existingItemIndex = currentCart.findIndex(item => item.product_id === product.id);

    let updatedItem: CartItem;

    if (existingItemIndex !== -1) {
      const newQuantity = currentCart[existingItemIndex].quantity + quantity;

      if (product.stock_quantity !== undefined && newQuantity > product.stock_quantity) {
        return throwError(() => new Error('Adding this quantity would exceed available stock'));
      }

      updatedItem = {
        ...currentCart[existingItemIndex],
        quantity: newQuantity
      };
      currentCart[existingItemIndex] = updatedItem;
    } else {
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

    const currentCart = [...this._items()];
    const existingItemIndex = currentCart.findIndex(item => item.product_id === product.id);

    let updatedItem: CartItem;

    if (existingItemIndex !== -1) {
      updatedItem = {
        ...currentCart[existingItemIndex],
        quantity: quantity
      };
      currentCart[existingItemIndex] = updatedItem;
    } else {
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
    if (!itemId) {
      return throwError(() => new Error('Invalid item ID'));
    }

    if (quantity < 1) {
      return throwError(() => new Error('Quantity must be at least 1'));
    }

    const currentCart = [...this._items()];
    const itemIndex = currentCart.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
      return throwError(() => new Error('Item not found in cart'));
    }

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
    if (!itemId) {
      return throwError(() => new Error('Invalid item ID'));
    }

    const currentCart = this._items();
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

  // Legacy getters for backward compatibility
  get cartCount(): number {
    return this.totalQuantity();
  }

  get cartTotal(): number {
    return this.subtotal();
  }

  // Promotion methods
  applyPromotion(appliedPromotion: AppliedPromotion): void {
    this.savePromotionToStorage(appliedPromotion);
  }

  removePromotion(): void {
    this.savePromotionToStorage(null);
  }

  getAppliedPromotion(): AppliedPromotion | null {
    return this._appliedPromotion();
  }

  clearCartAndPromotion(): Observable<void> {
    this.saveCartToStorage([]);
    this.savePromotionToStorage(null);
    return of(void 0);
  }
}
