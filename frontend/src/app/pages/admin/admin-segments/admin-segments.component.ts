import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmationService } from 'primeng/api';

import { ADMIN_LIST_IMPORTS, ADMIN_DIALOG_IMPORTS } from '../../../shared/imports/admin-shared.imports';
import { TableSkeletonComponent, SkeletonColumn } from '../../../shared/components/table-skeleton/table-skeleton.component';
import { AgroclikPageContainerComponent } from '../../../shared/components/agroclik-page-container/agroclik-page-container.component';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { SegmentService } from '../../../core/services/segment.service';
import { Segment } from '../../../models/segment.model';

@Component({
  selector: 'app-admin-segments',
  standalone: true,
  imports: [
    ...ADMIN_LIST_IMPORTS,
    ...ADMIN_DIALOG_IMPORTS,
    TableSkeletonComponent,
    AgroclikPageContainerComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-segments.component.html',
  styleUrl: './admin-segments.component.scss'
})
export class AdminSegmentsComponent implements OnInit {
  private segmentService = inject(SegmentService);
  private confirmationService = inject(ConfirmationService);
  private confirmDialog = inject(ConfirmationDialogService);
  private destroyRef = inject(DestroyRef);

  segments = signal<Segment[]>([]);
  loading = signal(false);
  tableInitialized = signal(false);

  // Create dialog
  showCreateDialog = signal(false);
  saving = signal(false);
  newName = '';
  newLabelFr = '';
  newLabelEn = '';
  newLabelAr = '';

  private buildTranslations(): Record<string, string> | undefined {
    const t: Record<string, string> = {};
    if (this.newLabelEn.trim()) t['en'] = this.newLabelEn.trim();
    if (this.newLabelAr.trim()) t['ar'] = this.newLabelAr.trim();
    return Object.keys(t).length ? t : undefined;
  }

  skeletonColumns: SkeletonColumn[] = [
    { width: '15%', type: 'pill-sm', headerWidth: '40px' },
    { width: '35%', type: 'text', headerWidth: '120px' },
    { width: '35%', type: 'text', headerWidth: '120px' },
    { width: '15%', type: 'actions', headerWidth: '60px' }
  ];

  ngOnInit(): void {
    this.loadSegments();
  }

  loadSegments(): void {
    this.loading.set(true);
    this.segmentService.getSegments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segments) => {
          this.segments.set(segments);
          this.loading.set(false);
          this.tableInitialized.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.tableInitialized.set(true);
        }
      });
  }

  openCreateDialog(): void {
    this.newName = '';
    this.newLabelFr = '';
    this.newLabelEn = '';
    this.newLabelAr = '';
    this.showCreateDialog.set(true);
  }

  createSegment(): void {
    if (!this.newName.trim() || !this.newLabelFr.trim()) return;
    this.saving.set(true);
    this.segmentService.createSegment({
      name: this.newName.trim(),
      label_fr: this.newLabelFr.trim(),
      label_translations: this.buildTranslations()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segment) => {
          this.segments.update(list => [...list, segment]);
          this.saving.set(false);
          this.showCreateDialog.set(false);
        },
        error: () => {
          this.saving.set(false);
        }
      });
  }

  confirmDelete(segment: Segment): void {
    this.confirmDialog.confirmDelete(
      this.confirmationService,
      segment.label_fr,
      () => this.deleteSegment(segment)
    );
  }

  private deleteSegment(segment: Segment): void {
    this.segmentService.deleteSegment(segment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.segments.update(list => list.filter(s => s.id !== segment.id));
        },
        error: () => {}
      });
  }
}
