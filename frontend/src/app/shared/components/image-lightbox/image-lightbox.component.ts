import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LightboxDetails {
  label: string;
  value: string;
}

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss'
})
export class ImageLightboxComponent {
  // Inputs
  imageUrl = input<string | null>(null);
  altText = input('Image');
  title = input<string | null>(null);
  subtitle = input<string | null>(null);
  details = input<LightboxDetails[]>([]);

  // Outputs
  close = output<void>();

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
