import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminNotificationItem, AdminNotificationService } from '../../../services/admin-notification.service';
import { RealtimeService } from '../../../../services/realtime.service';

@Component({
  selector: 'app-admin-header', // Tag <app-admin-header>
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.css']
})
export class AdminHeader implements OnInit, OnDestroy {

  // Nhận thông tin user từ component cha (AdminHome)
  @Input() currentUser: any = null;
  
  // Gửi sự kiện "click" ra cho cha để cha xử lý việc đóng/mở sidebar
  @Output() toggleSidebarClicked = new EventEmitter<void>();

  // Trạng thái riêng của header:
  showUserDropdown: boolean = false;
  showNotificationDropdown: boolean = false;
  unreadCount: number = 0;
  notifications: AdminNotificationItem[] = [];
  isLoadingNotifications: boolean = false;
  private notificationPollingTimer: ReturnType<typeof setInterval> | null = null;
  private removeAdminRealtimeListener: (() => void) | null = null;

  constructor(
    private router: Router,
    private adminNotificationService: AdminNotificationService,
    private realtimeService: RealtimeService
  ) { }

  ngOnInit() {
    this.loadNotifications();
    this.startNotificationPolling();
    this.realtimeService.joinAdminRoom();
    this.removeAdminRealtimeListener = this.realtimeService.on<AdminNotificationItem>('admin_notification_created', (payload) => {
      const exists = this.notifications.some((item) => item._id === payload._id);
      if (!exists) {
        this.notifications = [payload, ...this.notifications].slice(0, 30);
        this.unreadCount += payload.isRead ? 0 : 1;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.notificationPollingTimer) {
      clearInterval(this.notificationPollingTimer);
      this.notificationPollingTimer = null;
    }

    if (this.removeAdminRealtimeListener) {
      this.removeAdminRealtimeListener();
      this.removeAdminRealtimeListener = null;
    }
  }

  // Xử lý đăng xuất
  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/admin-login']);
  }

  // Phát sự kiện ra cho cha
  onToggleSidebar() {
    this.toggleSidebarClicked.emit();
  }

  private startNotificationPolling(): void {
    if (this.notificationPollingTimer) {
      return;
    }

    this.notificationPollingTimer = setInterval(() => {
      this.loadNotifications(false);
    }, 10000);
  }

  private loadNotifications(showLoader: boolean = true): void {
    if (showLoader) {
      this.isLoadingNotifications = true;
    }

    this.adminNotificationService.getAdminNotifications().subscribe({
      next: (result) => {
        this.notifications = result.notifications;
        this.unreadCount = result.unreadCount;
        this.isLoadingNotifications = false;
      },
      error: () => {
        this.isLoadingNotifications = false;
      }
    });
  }

  toggleNotificationDropdown(event: Event): void {
    event.stopPropagation();
    this.showNotificationDropdown = !this.showNotificationDropdown;
    this.showUserDropdown = false;

    if (this.showNotificationDropdown) {
      this.loadNotifications();
    }
  }

  markAllNotificationsAsRead(event: Event): void {
    event.stopPropagation();
    this.adminNotificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) => ({ ...item, isRead: true }));
        this.unreadCount = 0;
      }
    });
  }

  openNotification(item: AdminNotificationItem, event: Event): void {
    event.stopPropagation();

    const goToTarget = () => {
      if (item.type === 'recruitment_application') {
        this.router.navigate(['/admin/recruitment-management'], {
          queryParams: {
            tab: 'applications',
            applicationId: item.bookingId
          }
        });
      } else if (item.type === 'support_request') {
        this.router.navigate(['/admin/support-management'], {
          queryParams: {
            requestId: item._id
          }
        });
      } else {
        this.router.navigate(['/admin/ticket-management'], {
          queryParams: {
            tab: 'transaction',
            bookingId: item.bookingId
          }
        });
      }
      this.showNotificationDropdown = false;
    };

    if (item.isRead) {
      goToTarget();
      return;
    }

    this.adminNotificationService.markAsRead(item._id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) => n._id === item._id ? { ...n, isRead: true } : n);
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        goToTarget();
      },
      error: () => {
        goToTarget();
      }
    });
  }

  relativeTime(value: string): string {
    const created = new Date(value).getTime();
    if (!created) {
      return '';
    }

    const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return `${Math.floor(diffSec / 86400)} ngày trước`;
  }

  // Đóng/mở dropdown user
  toggleUserDropdown(event: Event) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra document
    this.showUserDropdown = !this.showUserDropdown;
    this.showNotificationDropdown = false;
  }

  // Đóng dropdown user khi click ra ngoài
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showUserDropdown) this.showUserDropdown = false;
    if (this.showNotificationDropdown) this.showNotificationDropdown = false;
  }
}