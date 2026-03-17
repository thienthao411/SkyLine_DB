import { Injectable } from '@angular/core';

export interface NotificationEntry {
  id: string;
  title: string;
  message: string;
  type: 'account' | 'payment' | 'system';
  createdAt: string;
  read: boolean;
  reference?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly storageKey = 'skylineNotifications';

  getNotifications(): NotificationEntry[] {
    const rawValue = localStorage.getItem(this.storageKey);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as NotificationEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  addNotification(payload: Omit<NotificationEntry, 'id' | 'createdAt' | 'read'>): NotificationEntry {
    const notifications = this.getNotifications();

    if (payload.reference) {
      const existingNotification = notifications.find((item) => item.reference === payload.reference);
      if (existingNotification) {
        return existingNotification;
      }
    }

    const newNotification: NotificationEntry = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    notifications.unshift(newNotification);
    localStorage.setItem(this.storageKey, JSON.stringify(notifications));

    return newNotification;
  }

  markAllAsRead(): void {
    const notifications = this.getNotifications().map((item) => ({
      ...item,
      read: true,
    }));

    localStorage.setItem(this.storageKey, JSON.stringify(notifications));
  }
}
