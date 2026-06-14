import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_FORM_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { AdminService } from '../../../services/admin.service';
import { ROUTES } from '../../../core/constants/routes.constants';

@Component({
  selector: 'app-admin-create-user',
  standalone: true,
  imports: [...ADMIN_FORM_IMPORTS, AgroclikPageContainerComponent],
  templateUrl: './admin-create-user.component.html',
  styleUrl: './admin-create-user.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminCreateUserComponent {
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastMessageService);

  firstName = signal('');
  lastName = signal('');
  storeName = signal('');
  role = signal('customer');
  phone = signal('');
  email = signal('');
  password = signal('Agro2202');
  address = signal("Rue de l'Hôpital, Ouadhia, Tizi Ouzou");
  creating = signal(false);

  readonly roleOptions = [
    { label: 'Client', value: 'customer' },
    { label: 'Chauffeur', value: 'driver' }
  ];

  onFirstName(value: string): void {
    this.firstName.set(value);
    this.updateEmail();
  }

  onLastName(value: string): void {
    this.lastName.set(value);
    this.updateEmail();
  }

  private updateEmail(): void {
    const first = this.firstName().trim().toLowerCase().replace(/\s+/g, '');
    const last = this.lastName().trim().toLowerCase().replace(/\s+/g, '');
    if (first || last) {
      this.email.set(`${last}.${first}@gmail.com`);
    }
  }

  goBack(): void {
    this.router.navigate([ROUTES.ADMIN.USERS]);
  }

  submit(): void {
    const firstName = this.firstName().trim();
    const lastName = this.lastName().trim();
    const email = this.email().trim();
    const password = this.password().trim();

    if (!firstName || !lastName || !email || !password) {
      this.toast.showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.creating.set(true);
    this.adminService.createUser({
      full_name: `${firstName} ${lastName}`,
      store_name: this.storeName().trim() || null,
      role: this.role(),
      phone: this.phone().trim() || null,
      email,
      password,
      address: this.address().trim() || null
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.toast.showSuccess('Compte créé avec succès');
        this.router.navigate([ROUTES.ADMIN.USERS]);
      },
      error: (err) => {
        this.creating.set(false);
        const detail = err?.error?.detail || '';
        this.toast.showError(
          detail.includes('already exists') ? 'Cet email est déjà utilisé' : 'Erreur lors de la création du compte'
        );
      }
    });
  }
}
