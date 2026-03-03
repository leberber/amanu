import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { PromotionService } from '../../services/promotion.service';
import { Promotion } from '../../models/promotion.model';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CurrencyPipe } from '../../shared/pipes/currency.pipe';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    TranslateModule,
    TagModule,
    SkeletonModule,
    PageLayoutComponent,
    EmptyStateComponent
  ],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.scss'
})
export class PromotionsComponent implements OnInit {
  private promotionService = inject(PromotionService);
  private destroyRef = inject(DestroyRef);

  readonly routes = ROUTES;

  promotions = signal<Promotion[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.error.set(false);
    this.promotionService.getActivePromotions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.promotions.set(promotions);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  getScopeLabel(scope: string): string {
    const labels: Record<string, string> = {
      'global': 'promotions_page.scope.global',
      'category': 'promotions_page.scope.category',
      'brand': 'promotions_page.scope.brand',
      'product': 'promotions_page.scope.product'
    };
    return labels[scope] || scope;
  }

  getScopeSeverity(scope: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    const severities: Record<string, 'success' | 'info' | 'warn' | 'secondary'> = {
      'global': 'success',
      'category': 'info',
      'brand': 'warn',
      'product': 'secondary'
    };
    return severities[scope];
  }

  getDaysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
  }
}
