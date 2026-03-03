import { Injectable, signal, computed, inject } from '@angular/core';
import { Product } from '../models/product.model';
import { AppliedPromotion } from '../models/promotion.model';
import { StorageService } from '../core/services/storage.service';

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

/**
 * Manages shopping cart state with localStorage persistence.
 * All operations are synchronous - state updates trigger signal reactivity.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storage = inject(StorageService);

  // State
  private readonly _items = signal<CartItem[]>([]);
  private readonly _promotion = signal<AppliedPromotion | null>(null);

  // Public signals
  readonly items = this._items.asReadonly();
  readonly appliedPromotion = this._promotion.asReadonly();

  // Computed
  readonly itemCount = computed(() => this._items().length);
  readonly totalQuantity = computed(() => this._items().reduce((sum, item) => sum + item.quantity, 0));
  readonly subtotal = computed(() => this._items().reduce((sum, item) => sum + item.product_price * item.quantity, 0));
  readonly discountAmount = computed(() => this._promotion()?.discount_amount ?? 0);
  readonly finalTotal = computed(() => Math.max(0, this.subtotal() - this.discountAmount()));
  readonly canCheckout = computed(() => this._items().length > 0);

  constructor() {
    this.loadFromStorage();
  }

  // Queries
  isInCart(productId: number): boolean {
    return this._items().some(item => item.product_id === productId);
  }

  getQuantity(productId: number): number {
    return this._items().find(item => item.product_id === productId)?.quantity ?? 0;
  }

  getItemsForDiscount() {
    return this._items().map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      category_id: item.category_id,
      brand_id: item.brand_id
    }));
  }

  // Cart mutations
  addToCart(product: Product, quantity: number): CartItem | null {
    if (!product?.id || quantity < 1) return null;
    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) return null;

    const items = [...this._items()];
    const existingIndex = items.findIndex(item => item.product_id === product.id);

    let cartItem: CartItem;

    if (existingIndex !== -1) {
      const newQuantity = items[existingIndex].quantity + quantity;
      if (product.stock_quantity !== undefined && newQuantity > product.stock_quantity) return null;
      cartItem = { ...items[existingIndex], quantity: newQuantity };
      items[existingIndex] = cartItem;
    } else {
      cartItem = this.createCartItem(product, quantity);
      items.push(cartItem);
    }

    this._items.set(items);
    this.persist();
    return cartItem;
  }

  setQuantity(product: Product, quantity: number): CartItem | null {
    if (!product?.id || quantity < 1) return null;
    if (product.stock_quantity !== undefined && quantity > product.stock_quantity) return null;

    const items = [...this._items()];
    const existingIndex = items.findIndex(item => item.product_id === product.id);

    let cartItem: CartItem;

    if (existingIndex !== -1) {
      cartItem = { ...items[existingIndex], quantity };
      items[existingIndex] = cartItem;
    } else {
      cartItem = this.createCartItem(product, quantity);
      items.push(cartItem);
    }

    this._items.set(items);
    this.persist();
    return cartItem;
  }

  updateItem(itemId: string, quantity: number): CartItem | null {
    if (!itemId || quantity < 1) return null;

    const items = [...this._items()];
    const index = items.findIndex(item => item.id === itemId);
    if (index === -1) return null;

    const item = items[index];
    if (item.stock_quantity !== undefined && quantity > item.stock_quantity) return null;

    items[index] = { ...item, quantity };
    this._items.set(items);
    this.persist();
    return items[index];
  }

  removeItem(itemId: string): boolean {
    if (!itemId) return false;
    const items = this._items();
    if (!items.some(item => item.id === itemId)) return false;

    this._items.set(items.filter(item => item.id !== itemId));
    this.persist();
    return true;
  }

  clear(): void {
    this._items.set([]);
    this.persist();
  }

  clearAll(): void {
    this._items.set([]);
    this._promotion.set(null);
    this.persist();
  }

  // Promotion mutations
  applyPromotion(promotion: AppliedPromotion): void {
    this._promotion.set(promotion);
    this.persist();
  }

  removePromotion(): void {
    this._promotion.set(null);
    this.persist();
  }

  // Private
  private loadFromStorage(): void {
    this._items.set(this.storage.getCart<CartItem>());
    this._promotion.set(this.storage.getCartPromo<AppliedPromotion>());
  }

  private persist(): void {
    this.storage.setCart(this._items());
    this.storage.setCartPromo(this._promotion());
  }

  private createCartItem(product: Product, quantity: number): CartItem {
    return {
      id: Date.now().toString(),
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_unit: product.unit,
      product_image: product.image_url,
      is_organic: product.is_organic,
      stock_quantity: product.stock_quantity,
      pieces_per_box: product.pieces_per_box,
      packaging_type: product.packaging_type,
      category_id: product.category_id,
      brand_id: product.brand_id,
      quantity
    };
  }
}
