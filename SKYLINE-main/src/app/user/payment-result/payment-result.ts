import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { TicketApiService, BookingRecord } from '../services/ticket-api.service';
import { AuthService } from '../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';
import { UserNotificationApiService, UserNotificationItem } from '../services/user-notification-api.service';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './payment-result.html',
  styleUrls: ['./payment-result.css']
})
export class PaymentResult implements OnInit, OnDestroy {
  isLoading = true;
  errorMessage = '';
  ticketCode = '';
  booking: BookingRecord | null = null;
  showToast = false;
  toastMessage = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private removeBookingRealtimeListener: (() => void) | null = null;
  private removeUserNotificationListener: (() => void) | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ticketApiService: TicketApiService,
    private authService: AuthService,
    private realtimeService: RealtimeService,
    private userNotificationApiService: UserNotificationApiService,
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('ticketCode');
    if (!code) {
      this.errorMessage = 'Không tìm thấy mã thanh toán.';
      this.isLoading = false;
      return;
    }

    this.ticketCode = code;
    this.realtimeService.joinBookingRoom(this.ticketCode);
    this.initRealtimeListeners();
    this.fetchBooking();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
    this.clearToastTimer();
    if (this.removeBookingRealtimeListener) this.removeBookingRealtimeListener();
    if (this.removeUserNotificationListener) this.removeUserNotificationListener();
  }

  fetchBooking(): void {
    this.isLoading = true;
    this.ticketApiService.getBooking(this.ticketCode).subscribe({
      next: (booking) => {
        this.booking = booking;
        const userEmail = String(booking.passengerInfo?.['email'] || '').trim().toLowerCase();
        if (userEmail) {
          this.realtimeService.joinUserRoom(userEmail);
          this.loadUnreadUserNotifications(userEmail);
        }
        this.setupAutoRefresh();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Không thể tải trạng thái thanh toán. Vui lòng thử lại.';
        this.clearRefreshTimer();
        this.isLoading = false;
      }
    });
  }

  get statusText(): string {
    const status = this.booking?.status;
    if (status === 'processing') return 'Đang chờ đối soát chuyển khoản';
    if (status === 'paid' || status === 'issued') return 'Thanh toán thành công';
    if (status === 'failed') return 'Thanh toán thất bại';
    if (status === 'expired') return 'Đơn đã hết hạn';
    if (status === 'cancelled') return 'Đơn đã hủy';
    return 'Đang chờ thanh toán';
  }

  get statusDescription(): string {
    if (this.isPendingLike) {
      return 'Hệ thống đang đồng bộ trạng thái thanh toán, bạn có thể bấm làm mới sau ít phút.';
    }
    if (this.isSuccessStatus) {
      return 'Thanh toán thành công. Vé điện tử đã được gửi vào email của hành khách.';
    }
    return 'Đơn chưa thể tiếp tục, vui lòng kiểm tra lại thanh toán hoặc đặt chuyến mới.';
  }

  get isSuccessStatus(): boolean {
    return this.booking?.status === 'paid' || this.booking?.status === 'issued';
  }

  get isPendingLike(): boolean {
    return this.booking?.status === 'pending' || this.booking?.status === 'processing';
  }

  get isFailedLike(): boolean {
    return this.booking?.status === 'failed' || this.booking?.status === 'expired' || this.booking?.status === 'cancelled';
  }

  get statusClass(): string {
    const status = this.booking?.status;
    if (status === 'processing') return 'processing';
    if (status === 'paid' || status === 'issued') return 'ok';
    if (status === 'failed' || status === 'expired' || status === 'cancelled') return 'error';
    return 'pending';
  }

  get passengerEmail(): string {
    return String(this.booking?.passengerInfo?.['email'] || '').trim();
  }

  get passengerName(): string {
    return String(this.booking?.passengerInfo?.['fullName'] || '').trim();
  }

  get submittedAtValue(): string | null {
    const payment: any = this.booking?.payment;
    return typeof payment?.submittedAt === 'string' ? payment.submittedAt : null;
  }

  get transactionRefValue(): string | null {
    const payment: any = this.booking?.payment;
    return typeof payment?.transactionRef === 'string' ? payment.transactionRef : null;
  }

  get payerNameValue(): string | null {
    const payment: any = this.booking?.payment;
    return typeof payment?.payerName === 'string' ? payment.payerName : null;
  }

  get paidAtValue(): string | null {
    const payment: any = this.booking?.payment;
    return typeof payment?.paidAt === 'string' ? payment.paidAt : null;
  }

  get hasTransactionDetails(): boolean {
    return !!(this.payerNameValue || this.transactionRefValue || this.submittedAtValue || this.paidAtValue);
  }

  get canLookupTicketNow(): boolean {
    return this.isSuccessStatus && this.isPassengerSignedIn;
  }

  get lookupButtonLabel(): string {
    if (this.canLookupTicketNow) {
      return 'Tra cứu vé ngay';
    }
    return 'Đăng nhập để tra cứu vé';
  }

  get shouldRequireSignInForLookup(): boolean {
    return this.isSuccessStatus && !this.isPassengerSignedIn;
  }

  get isPassengerSignedIn(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.email || !this.passengerEmail) {
      return false;
    }

    return currentUser.email.trim().toLowerCase() === this.passengerEmail.trim().toLowerCase();
  }

  private setupAutoRefresh(): void {
    if (this.booking?.status !== 'pending' && this.booking?.status !== 'processing') {
      this.clearRefreshTimer();
      return;
    }

    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      if (!this.isLoading) {
        this.fetchBooking();
      }
    }, 10000);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private clearToastTimer(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  private showToastMessage(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    this.clearToastTimer();

    this.toastTimer = setTimeout(() => {
      this.showToast = false;
      this.toastMessage = '';
    }, 3600);
  }

  private initRealtimeListeners(): void {
    if (!this.removeBookingRealtimeListener) {
      this.removeBookingRealtimeListener = this.realtimeService.on<{
        ticketCode: string;
        paymentStatus: string;
        message?: string;
      }>('booking_payment_updated', (payload) => {
        if (!payload || payload.ticketCode !== this.ticketCode) {
          return;
        }

        if (payload.message) {
          this.showToastMessage(payload.message);
        }

        this.fetchBooking();
      });
    }

    if (!this.removeUserNotificationListener) {
      this.removeUserNotificationListener = this.realtimeService.on<UserNotificationItem>('user_notification_created', (payload) => {
        if (!payload || payload.bookingId !== this.ticketCode) {
          return;
        }

        this.showToastMessage(payload.message || payload.title);
        if (payload._id) {
          this.userNotificationApiService.markAsRead(payload._id).subscribe();
        }
      });
    }
  }

  private loadUnreadUserNotifications(email: string): void {
    this.userNotificationApiService.getNotifications(email).subscribe({
      next: (res) => {
        const firstUnread = res.notifications.find((item) => !item.isRead && item.bookingId === this.ticketCode);
        if (firstUnread) {
          this.showToastMessage(firstUnread.message || firstUnread.title);
          this.userNotificationApiService.markAsRead(firstUnread._id).subscribe();
        }
      }
    });
  }

  goToCheckTicket(): void {
    if (!this.isSuccessStatus) {
      return;
    }

    if (!this.isPassengerSignedIn) {
      this.goToSignIn();
      return;
    }

    this.router.navigate(['/checkticket2'], { queryParams: { code: this.ticketCode } });
  }

  goToFlightSearch(): void {
    this.router.navigate(['/tim-chuyen-bay']);
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  goToSignIn(): void {
    this.router.navigate(['/customer-sign-in'], {
      queryParams: {
        email: this.passengerEmail || undefined,
        redirectTo: '/checkticket2',
        code: this.ticketCode || undefined,
      }
    });
  }
}


