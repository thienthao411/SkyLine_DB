import { Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserNotificationApiService, UserNotificationItem } from '../../services/user-notification-api.service';
import { RealtimeService } from '../../../services/realtime.service';
import { PromotionApiService } from '../../../services/promotion-api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements OnInit, OnDestroy {
  userName: string = 'Tài khoản';
  isLoggedIn: boolean = false;
  showDropdown: boolean = false;
  showNotificationDropdown = false;
  isLoadingNotifications = false;
  unreadNotificationCount = 0;
  notifications: UserNotificationItem[] = [];
  private userEmail = '';
  private removeUserNotificationListener: (() => void) | null = null;
  private notificationPollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private userNotificationApiService: UserNotificationApiService,
    private realtimeService: RealtimeService,
    private promotionApi: PromotionApiService
  ) {}

  ngOnInit(): void {
    // Get current user name
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userName = currentUser.name;
      this.isLoggedIn = true;
      this.userEmail = String(currentUser.email || '').trim().toLowerCase();
      this.loadUnreadNotifications();
      this.initRealtimeNotifications();
      this.startNotificationPolling();
    }
  }

  ngOnDestroy(): void {
    if (this.notificationPollingTimer) {
      clearInterval(this.notificationPollingTimer);
      this.notificationPollingTimer = null;
    }

    if (this.removeUserNotificationListener) {
      this.removeUserNotificationListener();
      this.removeUserNotificationListener = null;
    }
  }

  private startNotificationPolling(): void {
    if (this.notificationPollingTimer || !this.userEmail) {
      return;
    }

    this.notificationPollingTimer = setInterval(() => {
      this.loadNotifications(false);
    }, 10000);
  }

  private loadUnreadNotifications(): void {
    if (!this.userEmail) {
      this.unreadNotificationCount = 0;
      return;
    }

    this.userNotificationApiService.getNotifications(this.userEmail).subscribe({
      next: (res) => {
        this.unreadNotificationCount = Number(res.unreadCount || 0);
        this.notifications = Array.isArray(res.notifications) ? res.notifications : [];
      },
      error: () => {
        this.unreadNotificationCount = 0;
        this.notifications = [];
      }
    });
  }

  private loadNotifications(showLoader: boolean = true): void {
    if (!this.userEmail) {
      this.notifications = [];
      this.unreadNotificationCount = 0;
      return;
    }

    if (showLoader) {
      this.isLoadingNotifications = true;
    }

    this.userNotificationApiService.getNotifications(this.userEmail).subscribe({
      next: (res) => {
        this.notifications = Array.isArray(res.notifications) ? res.notifications : [];
        this.unreadNotificationCount = Number(res.unreadCount || 0);
        this.isLoadingNotifications = false;
      },
      error: () => {
        this.notifications = [];
        this.unreadNotificationCount = 0;
        this.isLoadingNotifications = false;
      }
    });
  }

  private initRealtimeNotifications(): void {
    if (!this.userEmail || this.removeUserNotificationListener) {
      return;
    }

    this.realtimeService.joinUserRoom(this.userEmail);
    this.removeUserNotificationListener = this.realtimeService.on<UserNotificationItem>('user_notification_created', (payload) => {
      if (!payload) return;

      const exists = this.notifications.some((item) => item._id === payload._id);
      if (!exists) {
        this.notifications = [payload, ...this.notifications].slice(0, 30);
      }

      if (!payload.isRead) {
        this.unreadNotificationCount += 1;
      }
    });
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) {
      this.showNotificationDropdown = false;
    }
  }

  toggleNotificationDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.showNotificationDropdown = !this.showNotificationDropdown;

    if (this.showNotificationDropdown) {
      this.loadNotifications();
    }
  }

  markAllNotificationsAsRead(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.userEmail || this.unreadNotificationCount <= 0) {
      return;
    }

    this.userNotificationApiService.markAllAsRead(this.userEmail).subscribe({
      next: () => {
        this.notifications = this.notifications.map((item) => ({ ...item, isRead: true }));
        this.unreadNotificationCount = 0;
      }
    });
  }

  openNotification(item: UserNotificationItem, event: MouseEvent): void {
    event.stopPropagation();
    const goToTarget = () => {
      const type = String(item.type || '').trim().toLowerCase();

      if (type === 'payment_status') {
        const ticketCode = String(item.bookingId || '').trim();
        if (ticketCode) {
          this.router.navigate(['/checkticket2'], {
            queryParams: { code: ticketCode }
          });
        } else {
          this.router.navigate(['/checkticket']);
        }
      } else if (type === 'recruitment_status') {
        this.router.navigate(['/tuyen-dung']);
      } else if (type === 'promotion') {
        this.navigateToPromotionNotification(item);
      } else if (type === 'support_message') {
        this.router.navigate(['/contact']);
      } else {
        this.router.navigate(['/notifications']);
      }

      this.showNotificationDropdown = false;
      this.showDropdown = false;
    };

    if (item.isRead) {
      goToTarget();
      return;
    }

    this.userNotificationApiService.markAsRead(item._id).subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) =>
          n._id === item._id ? { ...n, isRead: true } : n
        );
        this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
        goToTarget();
      },
      error: () => {
        goToTarget();
      }
    });
  }

  private navigateToPromotionNotification(item: UserNotificationItem): void {
    const ref = String(item.bookingId || '').trim();

    if (!ref) {
      this.router.navigate(['/promotion']);
      return;
    }

    // New notifications store concrete itemId in form: <promotionId>_<itemIndex>.
    if (ref.includes('_')) {
      this.router.navigate(['/promotion'], {
        queryParams: { itemId: ref }
      });
      return;
    }

    // Backward compatibility: old notifications only store promotionId.
    this.promotionApi.getAll().subscribe({
      next: (promotions) => {
        const matchedPromotion = (promotions || []).find((promotion) => String(promotion._id || '') === ref);
        if (!matchedPromotion) {
          this.router.navigate(['/promotion']);
          return;
        }

        const items = Array.isArray(matchedPromotion.items) ? matchedPromotion.items : [];
        if (items.length === 0) {
          this.router.navigate(['/promotion']);
          return;
        }

        const featuredIndex = items.findIndex((promotionItem) => promotionItem?.isFeatured === true);
        const itemIndex = featuredIndex >= 0 ? featuredIndex : 0;
        this.router.navigate(['/promotion'], {
          queryParams: { itemId: `${ref}_${itemIndex}` }
        });
      },
      error: () => {
        this.router.navigate(['/promotion']);
      }
    });
  }

  relativeTime(value: string): string {
    const created = new Date(value).getTime();
    if (!created) return '';

    const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    return `${Math.floor(diffSec / 86400)} ngày trước`;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event): void {
    const target = event.target as HTMLElement;
    const isInsideHeaderMenu = target.closest('.user-menu-wrapper');
    
    // Chỉ đóng nếu click outside và dropdown đang mở
    if (!isInsideHeaderMenu && this.showDropdown) {
      this.showDropdown = false;
    }

    if (!isInsideHeaderMenu && this.showNotificationDropdown) {
      this.showNotificationDropdown = false;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.showDropdown) {
      this.showDropdown = false;
    }

    if (this.showNotificationDropdown) {
      this.showNotificationDropdown = false;
    }
  }

  logout(): void {
    this.authService.logout();
    localStorage.removeItem('fullUserData');
    this.isLoggedIn = false;
    this.userName = 'Tài khoản';
    this.showDropdown = false;
    this.showNotificationDropdown = false;
    this.userEmail = '';
    this.unreadNotificationCount = 0;
    this.notifications = [];

    if (this.removeUserNotificationListener) {
      this.removeUserNotificationListener();
      this.removeUserNotificationListener = null;
    }

    if (this.notificationPollingTimer) {
      clearInterval(this.notificationPollingTimer);
      this.notificationPollingTimer = null;
    }

    this.router.navigate(['/customer-sign-in']);
  }

  navigateToInformation(event: MouseEvent): void {
    event.stopPropagation();
    this.showDropdown = false;
    this.router.navigate(['/information']);
  }

}
