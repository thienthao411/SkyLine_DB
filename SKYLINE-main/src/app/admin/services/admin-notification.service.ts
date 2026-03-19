import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface AdminNotificationItem {
  _id: string;
  title: string;
  message: string;
  bookingId: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface AdminNotificationResponse {
  success: boolean;
  unreadCount: number;
  notifications: AdminNotificationItem[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationService {
  private readonly apiUrl = 'http://localhost:5000/api/notifications';

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
}
