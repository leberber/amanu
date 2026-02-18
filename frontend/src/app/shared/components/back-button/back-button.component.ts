import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './back-button.component.html',
  styleUrls: ['./back-button.component.scss']
})
export class BackButtonComponent {
  @Input() route: string = '/';
  @Input() label: string = 'actions.go_back';
  @Input() showLabel: boolean = true;
  @Input() circular: boolean = false;
  @Input() fixed: boolean = false;
}
