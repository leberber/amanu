import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { RegisterStateService, RegistrationType } from '../../register-state.service';
import { ROUTES } from '../../../../core/constants/routes.constants';

@Component({
  selector: 'app-type-choice-step',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="register-header">
      <h1>Créer un compte</h1>
      <p>Choisissez votre type de compte</p>
    </div>

    <div class="registration-type-choice">
      <button type="button" class="type-card" (click)="selectType('customer')">
        <div class="type-icon customer">
          <i class="pi pi-shopping-bag"></i>
        </div>
        <div class="type-info">
          <h3>Client</h3>
          <p>Achetez des produits frais</p>
        </div>
        <i class="pi pi-chevron-right"></i>
      </button>

      <button type="button" class="type-card" (click)="selectType('driver')">
        <div class="type-icon driver">
          <i class="pi pi-truck"></i>
        </div>
        <div class="type-info">
          <h3>Chauffeur</h3>
          <p>Rejoignez notre équipe de livraison</p>
        </div>
        <i class="pi pi-chevron-right"></i>
      </button>
    </div>

    <div class="register-links">
      <span>{{ 'auth.already_have_account' | translate }}</span>
      <a [routerLink]="ROUTES.LOGIN">{{ 'auth.login_now' | translate }}</a>
    </div>
  `,
  styleUrls: ['../_shared-styles.scss']
})
export class TypeChoiceStepComponent {
  private state = inject(RegisterStateService);

  typeSelected = output<RegistrationType>();

  readonly ROUTES = ROUTES;

  selectType(type: RegistrationType): void {
    this.state.registrationType.set(type);
    this.typeSelected.emit(type);
  }
}
