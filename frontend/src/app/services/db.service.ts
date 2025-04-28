import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoginRequest, User } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class DbService {
  APIURL: string = 'http://127.0.0.1:8000/v1';
  http = inject(HttpClient);

  // User Management
  OnLogin(loginObj: LoginRequest) {
    return this.http.post<{message: string, user: LoginRequest}>(`${this.APIURL}/Login`, loginObj);
  }

  getUsers() {
    return this.http.get<User[]>(`${this.APIURL}/users`);
  }
  
  getUserById(user_id: number) {
    return this.http.get<User>(`${this.APIURL}/users/${user_id}`);
  }
  
  addUser(user: User) {
    return this.http.post<{message: string, user?: User}>(`${this.APIURL}/users/add`, user);
  }
  
  updateUser(user: User) {
    return this.http.put<{message: string, user?: User}>(`${this.APIURL}/users/update/${user.email}`, user);
  }
  
  deleteUser(userId: number) {
    return this.http.delete<any>(`${this.APIURL}/users/${userId}`);
  }
}