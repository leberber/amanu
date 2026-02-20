import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [],
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss'
})
export class ImageLightboxComponent {
  // Inputs
  imageUrl = input<string | null>(null);
  altText = input('Image');

  // Outputs
  close = output<void>();

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  onImageClick(event: Event): void {
    event.stopPropagation();
  }
}
