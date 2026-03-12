import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { trigger, transition, style, animate, query, stagger, keyframes } from '@angular/animations';

import { ADMIN_LIST_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { BatchingService } from '../../../services/batching.service';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import {
  Trip,
  TripWithStops,
  TripStatus,
  BatchingStats,
  PendingOrder,
  CustomBatch,
} from '../../../models/trip.model';
import { User } from '../../../models/user.model';
import { ROUTES, RouteHelpers } from '../../../core/constants/routes.constants';

type TabType = 'overview' | 'trips';
type BatchingState = 'orders' | 'batches';

@Component({
  selector: 'app-admin-batching',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    AgroclikPageContainerComponent,
    DialogModule,
    SelectModule,
    DragDropModule
  ],
  templateUrl: './admin-batching.component.html',
  styleUrl: './admin-batching.component.scss',
  providers: [ConfirmationService, MessageService],
  animations: [
    trigger('batchAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.8)' }))
      ])
    ]),
    trigger('orderCardAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('staggerAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger('50ms', [
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ]),
    trigger('organizeAnimation', [
      transition('orders => batches', [
        query('.order-card', [
          animate('400ms ease-in-out', keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(0.85)', offset: 0.3 }),
            style({ transform: 'scale(0.85) translateY(-10px)', offset: 0.6 }),
            style({ transform: 'scale(1) translateY(0)', offset: 1 })
          ]))
        ], { optional: true })
      ])
    ])
  ]
})
export class AdminBatchingComponent implements OnInit {
  private batchingService = inject(BatchingService);
  private toast = inject(ToastMessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // State
  loading = signal(true);
  loadingOrders = signal(false);
  organizingBatches = signal(false);
  submittingBatches = signal(false);
  activeTab = signal<TabType>('overview');
  batchingState = signal<BatchingState>('orders');

  // Data from service
  stats = this.batchingService.stats;
  trips = this.batchingService.trips;
  drivers = this.batchingService.drivers;

  // Pending orders for drag-drop
  pendingOrders = signal<PendingOrder[]>([]);

  // Custom batches after organizing
  customBatches = signal<CustomBatch[]>([]);
  unbatchedOrders = signal<PendingOrder[]>([]);

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

  // Computed for batch summary
  totalOrdersInBatches = computed(() =>
    this.customBatches().reduce((sum, b) => sum + b.orders.length, 0)
  );

  // Generate drop list IDs for CDK
  batchDropListIds = computed(() =>
    this.customBatches().map((_, i) => `batch-${i}`)
  );

  allDropListIds = computed(() =>
    [...this.batchDropListIds(), 'unbatched-list']
  );

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

    if (tab === 'overview' && this.batchingState() === 'orders' && this.pendingOrders().length === 0) {
      this.loadPendingOrders();
    }
  }

  // Load pending orders for drag-drop
  loadPendingOrders(): void {
    this.loadingOrders.set(true);
    this.batchingService.getPendingOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (orders) => {
          this.pendingOrders.set(orders);
          this.loadingOrders.set(false);
        },
        error: () => {
          this.loadingOrders.set(false);
          this.toast.showError('admin.batching.load_error');
        }
      });
  }

  // Organize orders into batches (run algorithm)
  organizeIntoBatches(): void {
    this.organizingBatches.set(true);

    // Simulate algorithm running with a short delay for animation
    setTimeout(() => {
      const orders = this.pendingOrders();

      // Group orders by zone
      const zoneGroups = new Map<string, PendingOrder[]>();
      orders.forEach(order => {
        const zone = order.zone || 'unknown';
        if (!zoneGroups.has(zone)) {
          zoneGroups.set(zone, []);
        }
        zoneGroups.get(zone)!.push(order);
      });

      // Create batches (max 3 orders per batch, min 2 to be a batch)
      const batches: CustomBatch[] = [];
      const unbatched: PendingOrder[] = [];

      zoneGroups.forEach((zoneOrders, zone) => {
        for (let i = 0; i < zoneOrders.length; i += 3) {
          const batchOrders = zoneOrders.slice(i, i + 3);

          if (batchOrders.length >= 2) {
            batches.push({
              order_ids: batchOrders.map(o => o.id),
              orders: batchOrders,
              zone: zone
            });
          } else {
            unbatched.push(...batchOrders);
          }
        }
      });

      this.customBatches.set(batches);
      this.unbatchedOrders.set(unbatched);
      this.batchingState.set('batches');
      this.organizingBatches.set(false);
    }, 600);
  }

  // Reset to orders view
  resetBatching(): void {
    this.batchingState.set('orders');
    this.customBatches.set([]);
    this.unbatchedOrders.set([]);
    this.loadPendingOrders();
  }

  // Approve and create trips
  approveAndCreateTrips(): void {
    const batches = this.customBatches();

    if (batches.length === 0) {
      this.toast.showWarn('admin.batching.no_batches_to_create');
      return;
    }

    this.confirmationService.confirm({
      message: `Create ${batches.length} trips from ${this.totalOrdersInBatches()} orders?`,
      header: 'Approve Batches',
      icon: 'pi pi-check-circle',
      accept: () => {
        this.submittingBatches.set(true);

        const batchData = batches.map(b => ({ order_ids: b.order_ids }));

        this.batchingService.runCustomBatching(batchData)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              this.submittingBatches.set(false);
              this.toast.showSuccess('admin.batching.run_success', {
                trips: response.trips_created,
                orders: response.orders_processed
              });
              // Reset and switch to trips tab
              this.batchingState.set('orders');
              this.customBatches.set([]);
              this.unbatchedOrders.set([]);
              this.pendingOrders.set([]);
              this.setActiveTab('trips');
              this.batchingService.getStats().subscribe();
            },
            error: (err) => {
              this.submittingBatches.set(false);
              this.toast.showApiError(err, 'admin.batching.run_error');
            }
          });
      }
    });
  }

  // Drag-drop handlers
  dropInBatch(event: CdkDragDrop<PendingOrder[]>, batchIndex: number): void {
    if (event.previousContainer === event.container) {
      // Reorder within same batch
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Move from another batch or unbatched
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update the batches
      this.updateBatchAfterDrop(batchIndex);
      this.cleanupEmptyBatches();
    }
  }

  dropInUnbatched(event: CdkDragDrop<PendingOrder[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      this.cleanupEmptyBatches();
    }
  }

  private updateBatchAfterDrop(batchIndex: number): void {
    const batches = this.customBatches();
    if (batches[batchIndex]) {
      const batch = batches[batchIndex];
      batch.order_ids = batch.orders.map(o => o.id);

      // Check if batch exceeds max (3 orders)
      if (batch.orders.length > 3) {
        // Move excess to unbatched
        const excess = batch.orders.splice(3);
        batch.order_ids = batch.orders.map(o => o.id);
        this.unbatchedOrders.update(orders => [...orders, ...excess]);
        this.toast.showWarn('admin.batching.max_orders_batch');
      }
    }
  }

  private cleanupEmptyBatches(): void {
    // Remove batches with less than 2 orders
    const batches = this.customBatches();
    const toRemove: PendingOrder[] = [];

    const validBatches = batches.filter(b => {
      if (b.orders.length < 2) {
        toRemove.push(...b.orders);
        return false;
      }
      return true;
    });

    if (toRemove.length > 0) {
      this.customBatches.set(validBatches);
      this.unbatchedOrders.update(orders => [...orders, ...toRemove]);
    }
  }

  // Create new batch from unbatched orders
  createNewBatch(): void {
    const unbatched = this.unbatchedOrders();
    if (unbatched.length < 2) {
      this.toast.showWarn('admin.batching.need_two_orders');
      return;
    }

    // Take first 2-3 orders to create new batch
    const newBatchOrders = unbatched.slice(0, Math.min(3, unbatched.length));
    const remaining = unbatched.slice(newBatchOrders.length);

    const newBatch: CustomBatch = {
      order_ids: newBatchOrders.map(o => o.id),
      orders: newBatchOrders,
      zone: newBatchOrders[0]?.zone
    };

    this.customBatches.update(batches => [...batches, newBatch]);
    this.unbatchedOrders.set(remaining);
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

  // Calculate batch total earnings
  getBatchTotalEarnings(batch: CustomBatch): number {
    return batch.orders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0);
  }

  // Calculate batch total weight
  getBatchTotalWeight(batch: CustomBatch): number {
    return batch.orders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
  }
}
