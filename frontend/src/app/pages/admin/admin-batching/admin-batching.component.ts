import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  Trip,
  TripWithStops,
  TripStatus,
  BatchingPreviewResponse,
  BatchingStats,
  ProposedTrip
} from '../../../models/trip.model';
import { User } from '../../../models/user.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

type TabType = 'overview' | 'trips' | 'preview';

@Component({
  selector: 'app-admin-batching',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    AgroclikPageContainerComponent,
    DialogModule,
    SelectModule
  ],
  templateUrl: './admin-batching.component.html',
  styleUrl: './admin-batching.component.scss',
  providers: [ConfirmationService, MessageService]
})
export class AdminBatchingComponent implements OnInit {
  private batchingService = inject(BatchingService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // State
  loading = signal(true);
  loadingPreview = signal(false);
  runningBatching = signal(false);
  activeTab = signal<TabType>('overview');

  // Data from service
  stats = this.batchingService.stats;
  trips = this.batchingService.trips;
  preview = this.batchingService.preview;
  drivers = this.batchingService.drivers;

  // Filters
  statusFilter = signal<TripStatus | null>(null);

  // Trip detail dialog
  showTripDialog = signal(false);
  selectedTrip = signal<TripWithStops | null>(null);
  loadingTripDetail = signal(false);

  // Assign dialog
  showAssignDialog = signal(false);
  tripToAssign = signal<Trip | null>(null);
  selectedDriverId: number | null = null;
  assigning = signal(false);

  // Computed
  filteredTrips = computed(() => {
    const allTrips = this.trips();
    const status = this.statusFilter();
    if (!status) return allTrips;
    return allTrips.filter(t => t.status === status);
  });

  pendingTrips = computed(() => this.trips().filter(t => t.status === 'pending'));
  assignedTrips = computed(() => this.trips().filter(t => t.status === 'assigned'));
  inProgressTrips = computed(() => this.trips().filter(t => t.status === 'in_progress'));

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    // Load stats
    this.batchingService.getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.toast.showError('admin.batching.load_error');
        }
      });

    // Load trips
    this.batchingService.getTrips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // Load drivers
    this.batchingService.getDrivers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  // Tab navigation
  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);

    if (tab === 'preview' && !this.preview()) {
      this.loadPreview();
    }
  }

  // Preview batching
  loadPreview(): void {
    this.loadingPreview.set(true);
    this.batchingService.previewBatching()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadingPreview.set(false),
        error: () => {
          this.loadingPreview.set(false);
          this.toast.showError('admin.batching.preview_error');
        }
      });
  }

  // Run batching
  runBatching(): void {
    this.confirmationService.confirm({
      message: 'This will create trips from pending orders. Continue?',
      header: 'Run Batching',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.runningBatching.set(true);
        this.batchingService.runBatching()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              this.runningBatching.set(false);
              this.toast.showSuccess('admin.batching.run_success', {
                trips: response.trips_created,
                orders: response.orders_processed
              });
              this.setActiveTab('trips');
            },
            error: () => {
              this.runningBatching.set(false);
              this.toast.showError('admin.batching.run_error');
            }
          });
      }
    });
  }

  // View trip details
  viewTripDetails(trip: Trip): void {
    this.loadingTripDetail.set(true);
    this.showTripDialog.set(true);

    this.batchingService.getTripDetail(trip.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tripWithStops) => {
          this.selectedTrip.set(tripWithStops);
          this.loadingTripDetail.set(false);
        },
        error: () => {
          this.loadingTripDetail.set(false);
          this.toast.showError('admin.batching.trip_detail_error');
          this.showTripDialog.set(false);
        }
      });
  }

  closeTripDialog(): void {
    this.showTripDialog.set(false);
    this.selectedTrip.set(null);
  }

  // Assign trip
  openAssignDialog(trip: Trip): void {
    this.tripToAssign.set(trip);
    this.selectedDriverId = null;
    this.showAssignDialog.set(true);
  }

  closeAssignDialog(): void {
    this.showAssignDialog.set(false);
    this.tripToAssign.set(null);
    this.selectedDriverId = null;
  }

  confirmAssign(): void {
    const trip = this.tripToAssign();
    const driverId = this.selectedDriverId;

    if (!trip || !driverId) return;

    this.assigning.set(true);
    this.batchingService.assignTrip(trip.id, driverId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assigning.set(false);
          this.toast.showSuccess('admin.batching.assign_success', {
            driver: response.trip?.driver_name
          });
          this.closeAssignDialog();
          this.batchingService.getStats().subscribe();
        },
        error: (err) => {
          this.assigning.set(false);
          this.toast.showApiError(err, 'admin.batching.assign_error');
        }
      });
  }

  // Unassign trip
  unassignTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Unassign trip #${trip.id} from ${trip.driver_name}?`,
      header: 'Unassign Trip',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.batchingService.unassignTrip(trip.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.showSuccess('admin.batching.unassign_success');
              this.batchingService.getStats().subscribe();
            },
            error: () => this.toast.showError('admin.batching.unassign_error')
          });
      }
    });
  }

  // Cancel trip
  cancelTrip(trip: Trip): void {
    this.confirmationService.confirm({
      message: `Cancel trip #${trip.id}? Orders will be returned to the pool.`,
      header: 'Cancel Trip',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.batchingService.cancelTrip(trip.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.toast.showSuccess('admin.batching.cancel_success'),
            error: () => this.toast.showError('admin.batching.cancel_error')
          });
      }
    });
  }

  // Navigate to order detail
  goToOrder(orderId: number): void {
    this.router.navigate([RouteHelpers.adminOrderDetail(orderId)]);
  }

  // Status helpers
  getStatusSeverity(status: TripStatus): 'secondary' | 'info' | 'warn' | 'success' | 'danger' {
    const severities: Record<TripStatus, 'secondary' | 'info' | 'warn' | 'success' | 'danger'> = {
      'pending': 'secondary',
      'assigned': 'info',
      'in_progress': 'warn',
      'completed': 'success',
      'cancelled': 'danger'
    };
    return severities[status] || 'secondary';
  }

  getStatusLabel(status: TripStatus): string {
    const labels: Record<TripStatus, string> = {
      'pending': 'Pending',
      'assigned': 'Assigned',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }

  // Filter by status
  filterByStatus(status: TripStatus | null): void {
    this.statusFilter.set(status);
    if (status) {
      this.batchingService.getTrips(status).subscribe();
    } else {
      this.batchingService.getTrips().subscribe();
    }
  }

  // Format zone name
  formatZone(zone: string | undefined): string {
    if (!zone) return 'Unknown';
    return zone.replace('zone_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
