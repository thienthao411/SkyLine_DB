import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { BookingApiService, BookingRecord } from '../services/booking-api.service';
import { AccountProvisionResult, AuthService } from '../services/auth.service';

interface AccountState {
  mode: 'idle' | 'checking' | 'existing' | 'created' | 'unavailable';
  title: string;
  message: string;
  tempPassword: string | null;
}

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
  accountState: AccountState = this.createIdleAccountState();
  isPreparingAccount = false;
  passwordCopied = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private passwordCopiedTimer: ReturnType<typeof setTimeout> | null = null;
  private accountFlowPrepared = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingApiService: BookingApiService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('ticketCode');
    if (!code) {
      this.errorMessage = 'Không tìm thấy mã thanh toán.';
      this.isLoading = false;
      return;
    }

    this.ticketCode = code;
    this.fetchBooking();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
    this.clearPasswordCopiedTimer();
  }

  fetchBooking(): void {
    this.isLoading = true;
    this.bookingApiService.getBooking(this.ticketCode).subscribe({
      next: (booking) => {
        this.booking = booking;
        this.setupAutoRefresh();
        if (booking.status === 'paid' || booking.status === 'issued') {
          this.prepareAccountExperience();
        } else {
          this.accountFlowPrepared = false;
          this.accountState = this.createIdleAccountState();
        }
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
      if (!this.isPassengerSignedIn) {
        return 'Vui lòng đăng nhập đúng tài khoản hành khách trước khi tra cứu vé.';
      }
      return 'Thanh toán đã hoàn tất. Bạn có thể tra cứu vé ngay.';
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

  get shouldShowAccountSection(): boolean {
    return this.isSuccessStatus;
  }

  get hasTransactionDetails(): boolean {
    return !!(this.payerNameValue || this.transactionRefValue || this.submittedAtValue || this.paidAtValue);
  }

  get canLookupTicketNow(): boolean {
    return this.isSuccessStatus && this.isPassengerSignedIn;
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

  private clearPasswordCopiedTimer(): void {
    if (this.passwordCopiedTimer) {
      clearTimeout(this.passwordCopiedTimer);
      this.passwordCopiedTimer = null;
    }
  }

  private createIdleAccountState(): AccountState {
    return {
      mode: 'idle',
      title: 'Đang chờ xử lý tài khoản',
      message: 'Sẽ kiểm tra tài khoản ngay khi thanh toán thành công.',
      tempPassword: null,
    };
  }

  private createUnavailableAccountState(message: string): AccountState {
    return {
      mode: 'unavailable',
      title: 'Chưa xử lý được tài khoản',
      message,
      tempPassword: null,
    };
  }

  private buildAccountState(result: AccountProvisionResult): AccountState {
    if (result.status === 'existing') {
      return {
        mode: 'existing',
        title: 'Khách đã có tài khoản',
        message: `Đăng nhập bằng ${result.user.email} để tra cứu vé của đặt chỗ này.`,
        tempPassword: null,
      };
    }

    return {
      mode: 'created',
      title: 'Đã tạo tài khoản mới',
      message: `Tài khoản ${result.user.email} đã được tạo. Đăng nhập rồi tiếp tục tra cứu vé.`,
      tempPassword: result.tempPassword || null,
    };
  }

  private prepareAccountExperience(): void {
    if (this.accountFlowPrepared || this.isPreparingAccount) {
      return;
    }

    if (!this.passengerEmail) {
      this.accountFlowPrepared = true;
      this.accountState = this.createUnavailableAccountState('Đơn đặt chỗ không có email hành khách nên không thể gửi thông tin tài khoản.');
      return;
    }

    this.isPreparingAccount = true;
    this.accountState = {
      mode: 'checking',
      title: 'Đang kiểm tra tài khoản',
      message: 'Hệ thống đang kiểm tra email để xác định tài khoản sẵn có hoặc tạo mới.',
      tempPassword: null,
    };

    this.authService.ensurePassengerAccount(this.passengerName || 'Khách hàng SKYLINE', this.passengerEmail)
      .then((result) => {
        this.accountState = this.buildAccountState(result);
        this.accountFlowPrepared = true;
        this.isPreparingAccount = false;
      })
      .catch(() => {
        this.accountFlowPrepared = true;
        this.accountState = this.createUnavailableAccountState('Không thể đối chiếu tài khoản hành khách từ dữ liệu hiện tại.');
        this.isPreparingAccount = false;
      });
  }

  goToCheckTicket(): void {
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
    this.router.navigate(['/customer-sign-in']);
  }

  async copyTemporaryPassword(): Promise<void> {
    const password = this.accountState.tempPassword;
    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      this.passwordCopied = true;
      this.clearPasswordCopiedTimer();
      this.passwordCopiedTimer = setTimeout(() => {
        this.passwordCopied = false;
      }, 1800);
    } catch {
      this.passwordCopied = false;
    }
  }
}
