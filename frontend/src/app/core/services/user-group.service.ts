import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  UserGroup,
  UserGroupCreate,
  UserGroupUpdate,
  UserGroupBasic,
  UserGroupsUpdate
} from '../../models/user-group.model';

@Injectable({
  providedIn: 'root'
})
export class UserGroupService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/user-groups`;

  // Cache for groups
  private groupsCache$ = new BehaviorSubject<UserGroup[]>([]);
  public groups$ = this.groupsCache$.asObservable();

  /**
   * Get all user groups
   */
  getGroups(activeOnly: boolean = false): Observable<UserGroup[]> {
    let params = new HttpParams().set('active_only', activeOnly.toString());

    return this.http.get<UserGroup[]>(`${this.apiUrl}`, { params }).pipe(
      map(groups => groups.sort((a, b) => a.name.localeCompare(b.name))),
      tap(groups => this.groupsCache$.next(groups))
    );
  }

  /**
   * Get group by ID
   */
  getGroup(id: number): Observable<UserGroup> {
    return this.http.get<UserGroup>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new group (staff only)
   */
  createGroup(group: UserGroupCreate): Observable<UserGroup> {
    return this.http.post<UserGroup>(`${this.apiUrl}`, group);
  }

  /**
   * Update group (staff only)
   */
  updateGroup(id: number, group: UserGroupUpdate): Observable<UserGroup> {
    return this.http.patch<UserGroup>(`${this.apiUrl}/${id}`, group);
  }

  /**
   * Delete group (staff only)
   */
  deleteGroup(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get users in a group
   */
  getGroupUsers(groupId: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/${groupId}/users`);
  }

  /**
   * Get groups for a user
   */
  getUserGroups(userId: number): Observable<UserGroupBasic[]> {
    return this.http.get<UserGroupBasic[]>(`${environment.apiUrl}/users/${userId}/groups`);
  }

  /**
   * Update user's groups
   */
  updateUserGroups(userId: number, groupIds: number[]): Observable<UserGroupBasic[]> {
    const payload: UserGroupsUpdate = { group_ids: groupIds };
    return this.http.put<UserGroupBasic[]>(`${environment.apiUrl}/users/${userId}/groups`, payload);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.groupsCache$.next([]);
  }
}
