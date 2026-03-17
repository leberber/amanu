import { Component, OnInit, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import {
  LineChartComponent,
  LineChartDataPoint,
  DoughnutChartComponent,
  DoughnutChartItem,
  BarChartComponent,
  BarChartDataPoint
} from '../../../shared/components/charts';
import { onLanguageChange } from '../../../core/utils/language-change.util';
import { AdminService } from '../../../services/admin.service';
import { SalesReport } from '../../../models/admin.model';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { TranslationHelperService } from '../../../core/services/translation-helper.service';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryLimitType = 5 | 10 | 15 | 20;

@Component({
  selector: 'app-admin-sales-report',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    AgroclikPageContainerComponent,
    LineChartComponent,
    DoughnutChartComponent,
    BarChartComponent
  ],
  templateUrl: './admin-sales-report.component.html',
  styleUrl: './admin-sales-report.component.scss'
})
export class AdminSalesReportComponent implements OnInit {
  // Data signals
  salesReport = signal<SalesReport | null>(null);
  loading = signal(true);
  selectedPeriod = signal<PeriodType>('daily');
  selectedCategoryLimit = signal<CategoryLimitType>(10);
  selectedProductLimit = signal<CategoryLimitType>(20);

  // Chart data signals (simplified for reusable components)
  lineChartData = signal<LineChartDataPoint[]>([]);
  topCategoryChartData = signal<DoughnutChartItem[]>([]);
  bottomCategoryChartData = signal<DoughnutChartItem[]>([]);
  productsChartData = signal<BarChartDataPoint[]>([]);

  // Period options
  readonly periodOptions: { value: PeriodType; labelKey: string; icon: string }[] = [
    { value: 'daily', labelKey: 'admin.sales_report.period.daily', icon: 'pi-calendar' },
    { value: 'weekly', labelKey: 'admin.sales_report.period.weekly', icon: 'pi-calendar-plus' },
    { value: 'monthly', labelKey: 'admin.sales_report.period.monthly', icon: 'pi-calendar-times' },
    { value: 'yearly', labelKey: 'admin.sales_report.period.yearly', icon: 'pi-chart-line' }
  ];

  // Category limit options
  readonly categoryLimitOptions: { value: CategoryLimitType; label: string }[] = [
    { value: 5, label: 'Top 5' },
    { value: 10, label: 'Top 10' },
    { value: 15, label: 'Top 15' },
    { value: 20, label: 'Top 20' }
  ];

  // Product limit options
  readonly productLimitOptions: { value: CategoryLimitType; label: string }[] = [
    { value: 5, label: 'Top 5' },
    { value: 10, label: 'Top 10' },
    { value: 15, label: 'Top 15' },
    { value: 20, label: 'Top 20' }
  ];

  // Computed
  hasData = computed(() => {
    const report = this.salesReport();
    return report !== null && report.data.length > 0;
  });

  hasCategoryData = computed(() => {
    const report = this.salesReport();
    return report !== null && report.sales_by_category && report.sales_by_category.length > 0;
  });

  // Services
  private adminService = inject(AdminService);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private currencyService = inject(CurrencyService);
  private translationHelper = inject(TranslationHelperService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadReport(this.selectedPeriod());
    onLanguageChange(this.translateService, this.destroyRef, () => this.prepareChartData());
  }

  loadReport(period?: PeriodType, categoryLimit?: CategoryLimitType, productLimit?: CategoryLimitType) {
    this.loading.set(true);

    if (period) {
      this.selectedPeriod.set(period);
    }
    if (categoryLimit) {
      this.selectedCategoryLimit.set(categoryLimit);
    }
    if (productLimit) {
      this.selectedProductLimit.set(productLimit);
    }

    this.adminService.getSalesReport(
      this.selectedPeriod(),
      undefined,
      undefined,
      this.selectedCategoryLimit(),
      this.selectedProductLimit()
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.salesReport.set(report);
          this.loading.set(false);
          this.prepareChartData();
        },
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.sales_report.load_error');
        }
      });
  }

  selectPeriod(period: PeriodType) {
    if (period !== this.selectedPeriod()) {
      this.loadReport(period);
    }
  }

  selectCategoryLimit(limit: number) {
    const validLimit = limit as CategoryLimitType;
    if (validLimit !== this.selectedCategoryLimit()) {
      this.loadReport(undefined, validLimit);
    }
  }

  selectProductLimit(limit: number) {
    const validLimit = limit as CategoryLimitType;
    if (validLimit !== this.selectedProductLimit()) {
      this.loadReport(undefined, undefined, validLimit);
    }
  }

  prepareChartData() {
    const report = this.salesReport();
    if (!report) {
      this.lineChartData.set([]);
      this.topCategoryChartData.set([]);
      this.bottomCategoryChartData.set([]);
      this.productsChartData.set([]);
      return;
    }

    // Prepare line chart data (sales over time)
    this.lineChartData.set(
      report.data.map(item => ({
        label: this.formatDateLabel(item.date),
        value: item.sales
      }))
    );

    // Prepare category chart data - split into top and bottom selling
    if (report.sales_by_category && report.sales_by_category.length > 0) {
      const limit = this.selectedCategoryLimit();
      const sortedCategories = [...report.sales_by_category];

      // Top selling (highest first) - already sorted from backend
      this.topCategoryChartData.set(
        sortedCategories.slice(0, limit).map(item => ({
          label: this.translationHelper.getCategoryName(item),
          value: item.total_sales
        }))
      );

      // Bottom selling (lowest first) - reverse and take from end
      const bottomCategories = [...sortedCategories].reverse();
      this.bottomCategoryChartData.set(
        bottomCategories.slice(0, limit).map(item => ({
          label: this.translationHelper.getCategoryName(item),
          value: item.total_sales
        }))
      );
    } else {
      this.topCategoryChartData.set([]);
      this.bottomCategoryChartData.set([]);
    }

    // Prepare products chart data
    if (report.top_products && report.top_products.length > 0) {
      this.productsChartData.set(
        report.top_products.map(item => ({
          label: this.translationHelper.getProductName(item),
          value: item.total_sales
        }))
      );
    } else {
      this.productsChartData.set([]);
    }
  }

  private formatDateLabel(dateStr: string): string {
    // Handle weekly format like "2024-W12"
    if (dateStr.includes('-W')) {
      const [year, weekPart] = dateStr.split('-W');
      return `W${weekPart} ${year}`;
    }

    // Handle yearly format like "2024"
    if (/^\d{4}$/.test(dateStr)) {
      return dateStr;
    }

    // Handle monthly format like "2024-03"
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString(this.translateService.currentLang, {
        month: 'short',
        year: 'numeric'
      });
    }

    // Handle daily format (ISO date)
    const date = new Date(dateStr);
    const period = this.selectedPeriod();

    if (period === 'daily') {
      return date.toLocaleDateString(this.translateService.currentLang, {
        day: 'numeric',
        month: 'short'
      });
    }

    return dateStr;
  }

  formatCurrency(value: number): string {
    return this.currencyService.formatCurrency(value);
  }
}
