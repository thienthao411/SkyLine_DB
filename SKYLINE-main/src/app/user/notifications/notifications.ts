import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserNotificationApiService, UserNotificationItem } from '../services/user-notification-api.service';
import { RealtimeService } from '../../services/realtime.service';

type NotificationCategory = 'promotion' | 'flight' | 'recruitment' | 'support';

interface NotificationPreferenceItem {
  key: NotificationCategory;
  name: string;
  enabled: boolean;
}

interface NotificationViewItem {
  id: string;
  title: string;
  message: string;
  type: string;
  category: NotificationCategory;
  createdAt: string;
  isRead: boolean;
}

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications implements OnInit, OnDestroy {
  inbox: NotificationViewItem[] = [];
  filteredInbox: NotificationViewItem[] = [];
  preferences: NotificationPreferenceItem[] = [
    { key: 'promotion', name: 'Thông báo ưu đãi và khuyến mãi', enabled: true },
    { key: 'flight', name: 'Thông báo chuyến bay và thanh toán vé', enabled: true },
    { key: 'recruitment', name: 'Thông báo hồ sơ ứng tuyển', enabled: true },
    { key: 'support', name: 'Tin nhắn hỗ trợ', enabled: true }
  ];
  isLoading = false;

  private userEmail = '';
  private removeUserNotificationListener: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private userNotificationApiService: UserNotificationApiService,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.userEmail = String(currentUser?.email || '').trim().toLowerCase();

    this.loadPreferences();
    this.loadNotifications();
    this.initRealtimeNotifications();
  }

  ngOnDestroy(): void {
    if (this.removeUserNotificationListener) {
      this.removeUserNotificationListener();
      this.removeUserNotificationListener = null;
    }
  }

  onPreferenceToggle(): void {
    this.persistPreferences();
    this.applyFilters();
  }

  typeLabel(type: string): string {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'payment_status') return 'Thanh toán';
    if (normalized === 'recruitment_status') return 'Tuyển dụng';
    if (normalized === 'promotion') return 'Khuyến mãi';
    if (normalized === 'support_message') return 'Hỗ trợ';
    return 'Hệ thống';
  }

  private loadNotifications(): void {
    if (!this.userEmail) {
      this.inbox = [];
      this.filteredInbox = [];
      return;
    }

    this.isLoading = true;
    this.userNotificationApiService.getNotifications(this.userEmail).subscribe({
      next: (res) => {
        this.inbox = (res.notifications || []).map((item) => this.toViewItem(item));
        this.applyFilters();
        this.markAllAsRead();
        this.isLoading = false;
      },
      error: () => {
        this.inbox = [];
        this.filteredInbox = [];
        this.isLoading = false;
      }
    });
  }

  private initRealtimeNotifications(): void {
    if (!this.userEmail || this.removeUserNotificationListener) {
      return;
    }

    this.realtimeService.joinUserRoom(this.userEmail);
    this.removeUserNotificationListener = this.realtimeService.on<UserNotificationItem>('user_notification_created', (payload) => {
      if (!payload) {
        return;
      }

      const viewItem = this.toViewItem(payload);
      const exists = this.inbox.some((item) => item.id === viewItem.id);
      if (exists) {
        return;
      }

      this.inbox = [viewItem, ...this.inbox];
      this.applyFilters();
    });
  }

  private toViewItem(item: UserNotificationItem): NotificationViewItem {
    return {
      id: String(item._id || ''),
      title: String(item.title || 'Thông báo từ Skyline'),
      message: String(item.message || ''),
      type: String(item.type || ''),
      category: this.mapTypeToCategory(item.type),
      createdAt: String(item.createdAt || new Date().toISOString()),
      isRead: Boolean(item.isRead)
    };
  }

  private mapTypeToCategory(type: string): NotificationCategory {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'payment_status' || normalized === 'flight_update') return 'flight';
    if (normalized === 'recruitment_status') return 'recruitment';
    if (normalized === 'promotion') return 'promotion';
    return 'support';
  }

  private applyFilters(): void {
    const enabledKeys = new Set(
      this.preferences.filter((item) => item.enabled).map((item) => item.key)
    );

    this.filteredInbox = this.inbox.filter((item) => enabledKeys.has(item.category));
  }

  private markAllAsRead(): void {
    if (!this.userEmail) {
      return;
    }

    this.userNotificationApiService.markAllAsRead(this.userEmail).subscribe();
  }

  private preferenceStorageKey(): string {
    return `skyline_notification_preferences:${this.userEmail || 'guest'}`;
  }

  private loadPreferences(): void {
    const raw = localStorage.getItem(this.preferenceStorageKey());
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Record<NotificationCategory, boolean>>;
      this.preferences = this.preferences.map((item) => ({
        ...item,
        enabled: parsed[item.key] ?? item.enabled
      }));
    } catch {
      // Keep defaults if storage is malformed.
    }
  }

  private persistPreferences(): void {
    const payload = this.preferences.reduce((acc, item) => {
      acc[item.key] = item.enabled;
      return acc;
    }, {} as Record<NotificationCategory, boolean>);

    localStorage.setItem(this.preferenceStorageKey(), JSON.stringify(payload));
  }
}
