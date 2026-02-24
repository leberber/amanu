// src/app/pages/admin/admin-notifications/admin-notifications.component.ts
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ADMIN_CORE_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { ROUTES } from '../../../core/constants/routes.constants';
import { NotificationService } from '../../../services/notification.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  SegmentInfo,
  CityStat,
  NotificationHistory,
  TargetedNotificationRequest,
  PromotionItem,
  ProductItem,
  CategoryItem,
  BrandItem,
  NotificationType,
  SegmentType,
  NotificationTemplate
} from '../../../models/notification.model';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [
    ...ADMIN_CORE_IMPORTS,
    ToastModule,
    SelectModule,
    DatePickerModule,
    CheckboxModule,
    TextareaModule,
    TranslateModule
  ],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss'
})
export class AdminNotificationsComponent implements OnInit {
  // Loading states
  loading = signal(true);
  sending = signal(false);
  tableInitialized = signal(false);

  // Data
  segments = signal<SegmentInfo[]>([]);
  cities = signal<CityStat[]>([]);
  history = signal<NotificationHistory[]>([]);
  promotions = signal<PromotionItem[]>([]);
  products = signal<ProductItem[]>([]);
  categories = signal<CategoryItem[]>([]);
  brands = signal<BrandItem[]>([]);

  // Form state
  selectedSegment = signal<SegmentType>('all');
  selectedCity = signal<string | null>(null);
  notificationType = signal<NotificationType>('custom');
  selectedTargetId = signal<number | null>(null);

  // Content
  titleEn = signal('');
  titleFr = signal('');
  titleAr = signal('');
  bodyEn = signal('');
  bodyFr = signal('');
  bodyAr = signal('');
  url = signal('/');
  imageUrl = signal('');

  // Scheduling
  scheduleEnabled = signal(false);
  scheduledDate = signal<Date | null>(null);
  minScheduleDate = new Date();

  // UI state
  activeTab = signal<'compose' | 'history'>('compose');
  recipientCount = signal(0);

  // Wizard/Carousel state
  currentStep = signal(1);
  totalSteps = 4;
  steps = [
    { step: 1, icon: 'pi-users', titleKey: 'admin.notifications.audience.title' },
    { step: 2, icon: 'pi-tag', titleKey: 'admin.notifications.content.type_label' },
    { step: 3, icon: 'pi-file-edit', titleKey: 'admin.notifications.content.title' },
    { step: 4, icon: 'pi-clock', titleKey: 'admin.notifications.schedule.title' }
  ];

  // Quick emojis
  quickEmojis = ['🔥', '🎉', '💰', '🛒', '✨', '🍎', '🥬', '⚡', '🆕', '💫'];

  // Templates
  templates: NotificationTemplate[] = [
    {
      id: 'flash_sale',
      name: 'Flash Sale',
      icon: 'pi-bolt',
      title_en: '⚡ Flash Sale!',
      title_fr: '⚡ Vente Flash!',
      title_ar: '⚡ تخفيضات سريعة!',
      body_en: 'Limited time offer - Don\'t miss out!',
      body_fr: 'Offre limitée - Ne manquez pas!',
      body_ar: 'عرض لفترة محدودة - لا تفوت الفرصة!'
    },
    {
      id: 'new_arrival',
      name: 'New Arrival',
      icon: 'pi-sparkles',
      title_en: '🆕 New Arrival!',
      title_fr: '🆕 Nouvelle Arrivée!',
      title_ar: '🆕 وصل حديثاً!',
      body_en: 'Check out our latest products',
      body_fr: 'Découvrez nos derniers produits',
      body_ar: 'اكتشف أحدث منتجاتنا'
    },
    {
      id: 'weekend_special',
      name: 'Weekend Special',
      icon: 'pi-calendar',
      title_en: '🎉 Weekend Special!',
      title_fr: '🎉 Spécial Week-end!',
      title_ar: '🎉 عرض نهاية الأسبوع!',
      body_en: 'Exclusive deals this weekend only',
      body_fr: 'Offres exclusives ce week-end seulement',
      body_ar: 'عروض حصرية لنهاية الأسبوع فقط'
    },
    {
      id: 'price_drop',
      name: 'Price Drop',
      icon: 'pi-arrow-down',
      title_en: '💰 Price Drop!',
      title_fr: '💰 Baisse de Prix!',
      title_ar: '💰 انخفاض الأسعار!',
      body_en: 'Prices just dropped on your favorites',
      body_fr: 'Les prix viennent de baisser sur vos favoris',
      body_ar: 'انخفضت الأسعار على منتجاتك المفضلة'
    }
  ];

  // Computed
  canSend = computed(() => {
    return this.titleFr().trim() && this.bodyFr().trim() && !this.sending();
  });

  selectedSegmentInfo = computed(() => {
    return this.segments().find(s => s.segment_type === this.selectedSegment());
  });

  currentTargetOptions = computed(() => {
    switch (this.notificationType()) {
      case 'promotion': return this.promotions();
      case 'product': return this.products();
      case 'category': return this.categories();
      case 'brand': return this.brands();
      default: return [];
    }
  });

  // Check if user can proceed to next step
  canProceedToNext = computed(() => {
    const step = this.currentStep();
    switch (step) {
      case 1: return this.selectedSegment() !== null;
      case 2: return this.notificationType() !== null;
      case 3: return this.titleFr().trim() !== '' && this.bodyFr().trim() !== '';
      case 4: return true;
      default: return false;
    }
  });

  // Services
  private router = inject(Router);
  private toast = inject(ToastMessageService);
  private translateService = inject(TranslateService);
  private notificationService = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    forkJoin({
      segments: this.notificationService.getSegments(),
      cities: this.notificationService.getCities(),
      history: this.notificationService.getHistory(),
      promotions: this.notificationService.getPromotions(),
      products: this.notificationService.getProducts(),
      categories: this.notificationService.getCategories(),
      brands: this.notificationService.getBrands()
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (data) => {
        this.segments.set(data.segments);
        this.cities.set(data.cities);
        this.history.set(data.history);
        this.promotions.set(data.promotions);
        this.products.set(data.products);
        this.categories.set(data.categories);
        this.brands.set(data.brands);

        // Set initial recipient count
        const allSegment = data.segments.find(s => s.segment_type === 'all');
        if (allSegment) {
          this.recipientCount.set(allSegment.count);
        }

        this.loading.set(false);
        setTimeout(() => this.tableInitialized.set(true), 100);
      },
      error: () => {
        this.loading.set(false);
        this.toast.showError('admin.notifications.load_error');
      }
    });
  }

  onSegmentChange(segmentType: SegmentType) {
    this.selectedSegment.set(segmentType);
    this.selectedCity.set(null);
    this.updateRecipientCount();
  }

  onCityChange(city: string | null) {
    this.selectedCity.set(city);
    if (city) {
      this.selectedSegment.set('by_city');
    }
    this.updateRecipientCount();
  }

  onNotificationTypeChange(type: NotificationType) {
    this.notificationType.set(type);
    this.selectedTargetId.set(null);

    if (type === 'custom') {
      // Clear auto-generated content
      this.clearContent();
    }
  }

  onTargetSelect(targetId: number) {
    this.selectedTargetId.set(targetId);
    this.autoGenerateContent(targetId);
  }

  autoGenerateContent(targetId: number) {
    const type = this.notificationType();
    const lang = this.translateService.currentLang || 'en';

    switch (type) {
      case 'promotion': {
        const promo = this.promotions().find(p => p.id === targetId);
        if (promo) {
          this.titleEn.set(`🎉 ${promo.name_en}`);
          this.titleFr.set(`🎉 ${promo.name_fr}`);
          this.titleAr.set(`🎉 ${promo.name_ar}`);
          this.bodyEn.set(promo.description_en || `Get ${promo.discount_value}% off with code ${promo.code}!`);
          this.bodyFr.set(promo.description_fr || `Obtenez ${promo.discount_value}% de réduction avec le code ${promo.code}!`);
          this.bodyAr.set(promo.description_ar || `احصل على خصم ${promo.discount_value}% باستخدام الكود ${promo.code}!`);
          this.url.set(`/promotions`);
        }
        break;
      }
      case 'product': {
        const product = this.products().find(p => p.id === targetId);
        if (product) {
          this.titleEn.set(`✨ Check out: ${product.name_en}`);
          this.titleFr.set(`✨ Découvrez: ${product.name_fr}`);
          this.titleAr.set(`✨ اكتشف: ${product.name_ar}`);
          this.bodyEn.set(`Now available for just $${product.price}!`);
          this.bodyFr.set(`Maintenant disponible pour seulement ${product.price}€!`);
          this.bodyAr.set(`متاح الآن بسعر ${product.price} فقط!`);
          this.url.set(`/products/${targetId}`);
          if (product.image_url) {
            this.imageUrl.set(product.image_url);
          }
        }
        break;
      }
      case 'category': {
        const category = this.categories().find(c => c.id === targetId);
        if (category) {
          this.titleEn.set(`🛒 Fresh ${category.name_en}!`);
          this.titleFr.set(`🛒 ${category.name_fr} Frais!`);
          this.titleAr.set(`🛒 ${category.name_ar} طازج!`);
          this.bodyEn.set(`Discover our selection of fresh ${category.name_en.toLowerCase()}`);
          this.bodyFr.set(`Découvrez notre sélection de ${category.name_fr.toLowerCase()} frais`);
          this.bodyAr.set(`اكتشف مجموعتنا من ${category.name_ar} الطازجة`);
          this.url.set(`/categories/${targetId}`);
          if (category.image_url) {
            this.imageUrl.set(category.image_url);
          }
        }
        break;
      }
      case 'brand': {
        const brand = this.brands().find(b => b.id === targetId);
        if (brand) {
          this.titleEn.set(`🏷️ New from ${brand.name_en}!`);
          this.titleFr.set(`🏷️ Nouveau de ${brand.name_fr}!`);
          this.titleAr.set(`🏷️ جديد من ${brand.name_ar}!`);
          this.bodyEn.set(`Check out the latest from ${brand.name_en}`);
          this.bodyFr.set(`Découvrez les dernières nouveautés de ${brand.name_fr}`);
          this.bodyAr.set(`اكتشف آخر المنتجات من ${brand.name_ar}`);
          this.url.set(`/brands/${targetId}`);
          if (brand.logo_url) {
            this.imageUrl.set(brand.logo_url);
          }
        }
        break;
      }
    }
  }

  applyTemplate(template: NotificationTemplate) {
    this.titleEn.set(template.title_en);
    this.titleFr.set(template.title_fr);
    this.titleAr.set(template.title_ar);
    this.bodyEn.set(template.body_en);
    this.bodyFr.set(template.body_fr);
    this.bodyAr.set(template.body_ar);
    this.notificationType.set('custom');
  }

  insertEmoji(emoji: string) {
    this.bodyEn.set(this.bodyEn() + emoji);
  }

  clearContent() {
    this.titleEn.set('');
    this.titleFr.set('');
    this.titleAr.set('');
    this.bodyEn.set('');
    this.bodyFr.set('');
    this.bodyAr.set('');
    this.url.set('/');
    this.imageUrl.set('');
  }

  updateRecipientCount() {
    const segment = this.selectedSegment();
    const city = this.selectedCity();

    this.notificationService.getPreviewCount(segment, city || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.recipientCount.set(result.count)
      });
  }

  sendNotification() {
    if (!this.canSend()) return;

    this.sending.set(true);

    const request: TargetedNotificationRequest = {
      title_en: this.titleEn(),
      title_fr: this.titleFr() || undefined,
      title_ar: this.titleAr() || undefined,
      body_en: this.bodyEn(),
      body_fr: this.bodyFr() || undefined,
      body_ar: this.bodyAr() || undefined,
      url: this.url() || '/',
      image_url: this.imageUrl() || undefined,
      segment_type: this.selectedSegment(),
      segment_value: this.selectedCity() || undefined,
      notification_type: this.notificationType(),
      target_id: this.selectedTargetId() || undefined,
      scheduled_at: this.scheduleEnabled() && this.scheduledDate()
        ? this.scheduledDate()!.toISOString()
        : undefined
    };

    this.notificationService.sendTargetedNotification(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.sending.set(false);
          if (response.scheduled) {
            this.toast.showSuccess('admin.notifications.scheduled_success');
          } else {
            this.toast.showSuccess('admin.notifications.sent_success', { count: response.sent });
          }
          this.clearContent();
          this.loadData(); // Refresh history
        },
        error: (error) => {
          this.sending.set(false);
          this.toast.showApiError(error, 'admin.notifications.sent_failed');
        }
      });
  }

  setActiveTab(tab: 'compose' | 'history') {
    this.activeTab.set(tab);
    if (tab === 'compose') {
      this.currentStep.set(1);
    }
  }

  nextStep() {
    if (this.currentStep() < this.totalSteps && this.canProceedToNext()) {
      this.currentStep.set(this.currentStep() + 1);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  goToStep(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep.set(step);
    }
  }

  getTargetName(item: any): string {
    const lang = this.translateService.currentLang || 'en';
    return item[`name_${lang}`] || item.name_en;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'sent': return 'success';
      case 'scheduled': return 'warning';
      case 'failed': return 'danger';
      default: return 'secondary';
    }
  }

  goBack() {
    this.router.navigate([ROUTES.ADMIN.BASE]);
  }
}
