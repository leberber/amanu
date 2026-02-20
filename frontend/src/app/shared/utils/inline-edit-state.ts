// src/app/shared/utils/inline-edit-state.ts

/**
 * Utility class for managing inline editing state.
 *
 * Usage:
 * ```typescript
 * // In component:
 * priceEdit = new InlineEditState<number>(0);
 * stockEdit = new InlineEditState<number>(0);
 *
 * // Start editing:
 * this.priceEdit.start(product.id, product.price);
 *
 * // Check if editing:
 * this.priceEdit.isEditing(product.id)
 *
 * // Get/set value:
 * this.priceEdit.value
 *
 * // Cancel:
 * this.priceEdit.cancel();
 * ```
 */
export class InlineEditState<T> {
  private _editingId: number | null = null;
  private _value: T;
  private _defaultValue: T;

  constructor(defaultValue: T) {
    this._defaultValue = defaultValue;
    this._value = defaultValue;
  }

  /**
   * Start editing an item
   * @param id - The item ID being edited
   * @param value - The current value to edit
   */
  start(id: number, value: T): void {
    this._editingId = id;
    this._value = value;
  }

  /**
   * Cancel editing and reset state
   */
  cancel(): void {
    this._editingId = null;
    this._value = this._defaultValue;
  }

  /**
   * Check if a specific item is being edited
   * @param id - The item ID to check
   */
  isEditing(id: number): boolean {
    return this._editingId === id;
  }

  /**
   * Check if any item is being edited
   */
  get isActive(): boolean {
    return this._editingId !== null;
  }

  /**
   * Get the ID of the item being edited
   */
  get editingId(): number | null {
    return this._editingId;
  }

  /**
   * Get the current editing value
   */
  get value(): T {
    return this._value;
  }

  /**
   * Set the editing value
   */
  set value(newValue: T) {
    this._value = newValue;
  }

  /**
   * Check if value has changed from original
   * @param originalValue - The original value to compare against
   */
  hasChanged(originalValue: T): boolean {
    return this._value !== originalValue;
  }
}
