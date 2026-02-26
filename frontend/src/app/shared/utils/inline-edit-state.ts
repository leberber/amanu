
export class InlineEditState<T> {
  private _editingId: number | null = null;
  private _value: T;
  private _defaultValue: T;

  constructor(defaultValue: T) {
    this._defaultValue = defaultValue;
    this._value = defaultValue;
  }


  start(id: number, value: T): void {
    this._editingId = id;
    this._value = value;
  }


  cancel(): void {
    this._editingId = null;
    this._value = this._defaultValue;
  }


  isEditing(id: number): boolean {
    return this._editingId === id;
  }


  get isActive(): boolean {
    return this._editingId !== null;
  }


  get editingId(): number | null {
    return this._editingId;
  }


  get value(): T {
    return this._value;
  }


  set value(newValue: T) {
    this._value = newValue;
  }


  hasChanged(originalValue: T): boolean {
    return this._value !== originalValue;
  }
}
