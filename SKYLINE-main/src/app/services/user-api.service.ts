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

export interface RankBenefitsConfig {
  ranks: Record<string, { name: string; benefits: string[] }>;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  expiresInMinutes?: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  resetToken?: string;
  expiresInMinutes?: number;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
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

  getRankBenefits(): Observable<RankBenefitsConfig> {
    return this.http.get<RankBenefitsConfig>(`${this.apiUrl}/rank-benefits`);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password });
  }

  register(userData: { fullName: string; email: string; password: string; avatar?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  changePassword(payload: {
    email: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>(`${this.apiUrl}/change-password`, payload);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<VerifyOtpResponse> {
    return this.http.post<VerifyOtpResponse>(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  resetPassword(payload: {
    email: string;
    resetToken: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(`${this.apiUrl}/reset-password`, payload);
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