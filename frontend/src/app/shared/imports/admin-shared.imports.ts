/**
 * Common imports shared across admin components.
 * These can be spread into the imports array of standalone components.
 *
 * Usage:
 * @Component({
 *   imports: [
 *     ...ADMIN_COMMON_IMPORTS,
 *     // component-specific imports
 *   ]
 * })
 */

// Common Angular modules
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Common PrimeNG modules used across admin components
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { CardModule } from 'primeng/card';

// Translation
import { TranslateModule } from '@ngx-translate/core';

// Shared pipes
import { CurrencyPipe } from '../pipes/currency.pipe';
import { UnitPipe } from '../pipes/unit.pipe';
import { DateFormatPipe } from '../pipes/date-format.pipe';
import { PhoneFormatPipe } from '../pipes/phone-format.pipe';

/**
 * Core imports needed by virtually all admin components
 */
export const ADMIN_CORE_IMPORTS = [
  CommonModule,
  FormsModule,
  TranslateModule,
  ButtonModule,
  ToastModule,
  TooltipModule
] as const;

/**
 * Additional imports for admin list/table components
 */
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TableSearchComponent } from '../components/table-search/table-search.component';
import { ImageFallbackDirective } from '../directives/image-fallback.directive';

export const ADMIN_LIST_IMPORTS = [
  ...ADMIN_CORE_IMPORTS,
  TableModule,
  TagModule,
  PaginatorModule,
  ConfirmDialogModule,
  InputTextModule,
  InputGroupModule,
  InputGroupAddonModule,
  ProgressSpinnerModule,
  IconFieldModule,
  InputIconModule,
  TableSearchComponent,
  CurrencyPipe,
  UnitPipe,
  DateFormatPipe,
  PhoneFormatPipe,
  ImageFallbackDirective
] as const;

/**
 * Additional imports for admin form components (add/edit)
 */
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';

export const ADMIN_FORM_IMPORTS = [
  ...ADMIN_CORE_IMPORTS,
  ReactiveFormsModule,
  CardModule,
  InputTextModule,
  TextareaModule,
  SelectModule,
  CheckboxModule
] as const;

/**
 * Dialog-related imports
 */
import { DialogModule } from 'primeng/dialog';

export const ADMIN_DIALOG_IMPORTS = [
  DialogModule,
  ConfirmDialogModule
] as const;
