import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.scss'
})
export class BackButtonComponent {
  route = input('/');
  label = input('actions.go_back');
  showLabel = input(true);
  circular = input(false);
  fixed = input(false);
}
