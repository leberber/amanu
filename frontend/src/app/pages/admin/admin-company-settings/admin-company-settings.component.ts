import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { FacturationService, CompanySettings, TimbreTier } from '../../../core/services/facturation.service';

import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-admin-company-settings',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    FormsModule,
    AgroclikPageContainerComponent,
    InputTextModule,
    InputNumberModule,
    CardModule,
    DividerModule,
    TextareaModule,
    ToastModule,
    ButtonModule,
  ],
  templateUrl: './admin-company-settings.component.html',
  styleUrl: './admin-company-settings.component.scss',
  animations: [
    trigger('pageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AdminCompanySettingsComponent implements OnInit {
  private facturationService = inject(FacturationService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  saving = signal(false);

  readonly DEFAULT_TIMBRE_TIERS: TimbreTier[] = [
    { max: 30000,  rate: 1   },
    { max: 100000, rate: 1.5 },
    { max: null,   rate: 2   },
  ];

  // Form fields
  name = '';
  activity = '';
  address = '';
  phone = '';
  rc = '';
  na = '';
  nif = '';
  nis = '';
  timbreTiers: TimbreTier[] = this.DEFAULT_TIMBRE_TIERS.map(t => ({ ...t }));

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.facturationService.getCompanySettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.name        = s.name ?? '';
          this.activity    = s.activity ?? '';
          this.address     = s.address ?? '';
          this.phone       = s.phone ?? '';
          this.rc          = s.rc ?? '';
          this.na          = s.na ?? '';
          this.nif         = s.nif ?? '';
          this.nis         = s.nis ?? '';
          this.timbreTiers = s.timbre_tiers?.length
            ? s.timbre_tiers.map(t => ({ ...t }))
            : this.DEFAULT_TIMBRE_TIERS.map(t => ({ ...t }));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('Erreur lors du chargement');
        }
      });
  }

  save(): void {
    if (!this.name.trim()) {
      this.toast.showWarn('La raison sociale est requise');
      return;
    }

    this.saving.set(true);
    this.facturationService.updateCompanySettings({
      name:         this.name,
      activity:     this.activity || undefined,
      address:      this.address || undefined,
      phone:        this.phone || undefined,
      rc:           this.rc || undefined,
      na:           this.na || undefined,
      nif:          this.nif || undefined,
      nis:          this.nis || undefined,
      timbre_tiers: this.timbreTiers,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.showSuccess('Paramètres sauvegardés');
        },
        error: () => {
          this.saving.set(false);
          this.toast.showError('Erreur lors de la sauvegarde');
        }
      });
  }
}
