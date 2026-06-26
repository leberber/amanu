import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Segment, SegmentCreate } from '../../models/segment.model';

@Injectable({ providedIn: 'root' })
export class SegmentService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/segments';

  getSegments(): Observable<Segment[]> {
    return this.http.get<Segment[]>(this.base);
  }

  createSegment(data: SegmentCreate): Observable<Segment> {
    return this.http.post<Segment>(this.base, data);
  }

  deleteSegment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getUserSegments(userId: number): Observable<number[]> {
    return this.http.get<number[]>(`/api/v1/users/${userId}/segments`);
  }

  updateUserSegments(userId: number, segmentIds: number[]): Observable<number[]> {
    return this.http.put<number[]>(`/api/v1/users/${userId}/segments`, { segment_ids: segmentIds });
  }
}
