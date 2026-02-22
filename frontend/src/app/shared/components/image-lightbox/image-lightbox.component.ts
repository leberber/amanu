import { Component, inject, input, output, computed } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UnitsService } from '../../../core/services/units.service';

export interface LightboxDetails {
  label: string;
  value: string;
}

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss'
})
export class ImageLightboxComponent {
  private translateService = inject(TranslateService);
  private unitsService = inject(UnitsService);

  // Inputs
  imageUrl = input<string | null>(null);
  altText = input('Image');
  title = input<string | null>(null);
  subtitle = input<string | null>(null);
  details = input<LightboxDetails[]>([]);

  // Packaging info inputs
  packagingType = input<string | null>(null);
  piecesPerBox = input<number | null>(null);
  unit = input<string | null>(null);
  cartonsCount = input<number | null>(null);

  // Outputs
  close = output<void>();

  // Computed - packaging type display
  packagingTypeDisplay = computed(() => {
    const type = this.packagingType();
    if (!type) return null;
    const key = `products.product.packaging_types.${type.toLowerCase()}`;
    return this.translateService.instant(key);
  });

  // Computed - pieces per box display
  piecesPerBoxDisplay = computed(() => {
    const pieces = this.piecesPerBox();
    const unitVal = this.unit();
    if (!pieces) return null;

    if (unitVal) {
      const unitDisplay = this.unitsService.getUnitTranslated(unitVal, false);
      return `${pieces} ${unitDisplay}`;
    }
    return `${pieces}`;
  });

  // Computed - cartons count display
  cartonsCountDisplay = computed(() => {
    const count = this.cartonsCount();
    if (count === null || count === undefined) return null;

    const type = this.packagingType() || 'carton';
    const suffix = count === 1 ? '' : '_plural';
    const key = `products.product.packaging_types.${type.toLowerCase()}${suffix}`;
    const typeDisplay = this.translateService.instant(key);
    return `${count} ${typeDisplay}`;
  });

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }
}
