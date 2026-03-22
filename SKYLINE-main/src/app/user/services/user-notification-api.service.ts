import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface UserNotificationItem {
  _id: string;
  userEmail: string;
  title: string;
  message: string;
  bookingId: string;
  type: string;
  paymentStatus?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserNotificationApiService {
  private readonly apiUrl = 'http://localhost:5000/api/notifications-user';

  constructor(private http: HttpClient) {}

  getNotifications(email: string): Observable<{ unreadCount: number; notifications: UserNotificationItem[] }> {
    return this.http
      .get<{ success: boolean; unreadCount: number; notifications: UserNotificationItem[] }>(
        `${this.apiUrl}?email=${encodeURIComponent(email)}`
      )
      .pipe(
        map((res) => ({
          unreadCount: Number(res.unreadCount || 0),
          notifications: Array.isArray(res.notifications) ? res.notifications : []
        }))
      );
  }

  markAsRead(id: string): Observable<UserNotificationItem> {
    return this.http
      .patch<{ success: boolean; notification: UserNotificationItem }>(
        `${this.apiUrl}/${encodeURIComponent(id)}/read`,
        {}
      )
      .pipe(map((res) => res.notification));
  }

  markAllAsRead(email: string): Observable<boolean> {
    return this.http
      .patch<{ success: boolean }>(
        `${this.apiUrl}/read-all`,
        { email: String(email || '').trim().toLowerCase() }
      )
      .pipe(map((res) => Boolean(res.success)));
  }
}
