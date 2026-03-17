import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  _id?: string;
  fullName: string;
  avatar: string;
  currentRank: string;
  points: number;
  nextRank: string;
  nextThreshold: number;
  email: string;
  password?: string;
  phone: string;
  birthday: string;
  gender: string;
  passport: string;
  passportExpiry: string;
  country: string;
  address: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private apiUrl = 'http://localhost:5000/api/users';

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/email/${encodeURIComponent(email)}`);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password });
  }

  register(userData: { fullName: string; email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  create(user: User): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  update(id: string, user: User): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, user);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}