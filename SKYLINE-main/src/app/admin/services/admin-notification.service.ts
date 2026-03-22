import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';

export interface AdminNotificationItem {
  _id: string;
  title: string;
  message: string;
  bookingId: string;
  type: string;
  supportRequest?: {
    fullName?: string;
    email?: string;
    topic?: string;
    content?: string;
    status?: 'new' | 'in_progress' | 'resolved';
    adminNote?: string;
    handledAt?: string | null;
  };
  isRead: boolean;
  createdAt: string;
}

export type SupportRequestStatus = 'new' | 'in_progress' | 'resolved';

interface AdminNotificationResponse {
  success: boolean;
  unreadCount: number;
  notifications: AdminNotificationItem[];
}

interface SupportRequestResponse {
  success: boolean;
  requests: AdminNotificationItem[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationService {
  private readonly apiUrl = 'http://localhost:5000/api/notifications';
  private readonly supportApiUrl = 'http://localhost:5000/api/supports';

  constructor(private http: HttpClient) {}

  getAdminNotifications(): Observable<{ unreadCount: number; notifications: AdminNotificationItem[] }> {
    return this.http
      .get<AdminNotificationResponse>(`${this.apiUrl}/admin`)
      .pipe(
        map((res) => ({
          unreadCount: Number(res.unreadCount || 0),
          notifications: Array.isArray(res.notifications) ? res.notifications : []
        }))
      );
  }

  markAsRead(id: string): Observable<AdminNotificationItem> {
    return this.http
      .patch<{ success: boolean; notification: AdminNotificationItem }>(`${this.apiUrl}/${encodeURIComponent(id)}/read`, {})
      .pipe(map((res) => res.notification));
  }

  markAllAsRead(): Observable<void> {
    return this.http
      .patch<{ success: boolean }>(`${this.apiUrl}/admin/read-all`, {})
      .pipe(map(() => undefined));
  }

  getSupportRequests(status: 'all' | SupportRequestStatus = 'all'): Observable<AdminNotificationItem[]> {
    const query = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
    const oldApiUrl = `${this.apiUrl}/admin/support-requests${query}`;

    return this.http
      .get<SupportRequestResponse>(`${this.supportApiUrl}/admin/requests${query}`)
      .pipe(
        map((res) => Array.isArray(res.requests) ? res.requests : []),
        catchError((error) => {
          return this.http
            .get<SupportRequestResponse>(oldApiUrl)
            .pipe(
              map((res) => Array.isArray(res.requests) ? res.requests : []),
              catchError(() => throwError(() => error))
            );
        })
      );
  }

  updateSupportRequestStatus(
    id: string,
    payload: { status: SupportRequestStatus; adminNote?: string }
  ): Observable<AdminNotificationItem> {
    const oldApiUrl = `${this.apiUrl}/admin/support-requests/${encodeURIComponent(id)}/status`;

    return this.http
      .patch<{ success: boolean; request: AdminNotificationItem }>(
        `${this.supportApiUrl}/admin/requests/${encodeURIComponent(id)}/status`,
        payload
      )
      .pipe(
        map((res) => res.request),
        catchError((error) => {
          return this.http
            .patch<{ success: boolean; request: AdminNotificationItem }>(oldApiUrl, payload)
            .pipe(
              map((res) => res.request),
              catchError(() => throwError(() => error))
            );
        })
      );
  }
}
