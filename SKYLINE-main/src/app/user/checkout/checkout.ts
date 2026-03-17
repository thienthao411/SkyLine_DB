import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import localeVi from '@angular/common/locales/vi';

import { BookingService } from '../services/booking.service';
import { BookingApiService, BookingRecord } from '../services/booking-api.service';

registerLocaleData(localeVi, 'vi');

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css']
})
export class Checkout implements OnInit, OnDestroy {

  paymentDeadline!: Date;
  ticketInfo: any = {};
  totalAmount: number = 0;
  isLoading: boolean = true;
  isUpdatingStatus: boolean = false;
  statusMessage: string = '';
  loadError: string = '';

  ticketCode: string = '';
  bookingStatus: string = 'pending';
  countdownText: string = '';
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  transactionRef: string = '';
  payerName: string = '';
  hasConfirmedTransfer: boolean = false;
  copiedField: 'amount' | 'content' | '' = '';

  readonly bankInfo = {
    bankName: 'Vietcombank',
    bankCode: 'VCB',
    accountName: 'CONG TY SKYLINE',
    accountNumber: '0321000999999',
  };

  flightDetails: any = null;
  seatDetails: string = '';
  seatType: string = '';
  baggageInfo: { name: string; price: number; code?: string } | null = null;
  baseFare: number = 0;
  feeAmount: number = 0;

  constructor(
    private bookingService: BookingService,
    private bookingApiService: BookingApiService,
    private router: Router
  ) {

  }

  ngOnInit(): void {
    this.fetchTicketData();
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  fetchTicketData(): void {
    this.isLoading = true;
    this.loadError = '';

    const code = this.bookingService.getData('ticketCode');
    if (!code) {
      console.error('Không tìm thấy mã đặt vé để tải checkout từ backend.');
      this.loadError = 'Không tìm thấy mã thanh toán. Vui lòng quay lại bước xác nhận đặt chỗ.';
      this.isLoading = false;
      return;
    }

    this.ticketCode = code;

    this.bookingApiService.getBooking(code).subscribe({
      next: (booking: BookingRecord) => {
        this.populateTicketData(booking);
        this.bookingService.setData('bookingSnapshot', booking);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Không thể tải booking từ backend:', error);
        const fallbackBooking = this.bookingService.getData('bookingSnapshot');
        if (fallbackBooking) {
          this.populateTicketData(fallbackBooking);
        } else {
          this.loadError = 'Không thể tải thông tin thanh toán. Vui lòng kiểm tra lại backend hoặc tạo lại đơn đặt chỗ.';
        }
        this.isLoading = false;
      }
    });
  }

  private populateTicketData(booking: BookingRecord): void {
    const bookingDateObj = new Date(booking.bookingDate);
    this.paymentDeadline = new Date(bookingDateObj.getTime() + 15 * 60 * 1000);

    this.ticketInfo = {
      name: booking.passengerInfo?.['fullName'],
      phone: booking.passengerInfo?.['phoneNumber'],
      bookingDate: bookingDateObj,
      email: booking.passengerInfo?.['email']
    };

    this.totalAmount = booking.totalAmount;
    this.flightDetails = booking.flight;
    this.seatDetails = booking.seat;
    this.seatType = booking.seatType ?? '';
    this.bookingStatus = booking.status ?? 'pending';
    this.ticketCode = booking.ticketCode;
    this.baggageInfo = booking.baggageOption
      ? {
          name: booking.baggageOption.name,
          price: Number(booking.baggageOption.price ?? 0),
          code: booking.baggageOption.code
        }
      : null;

    this.baseFare = Number(booking.flight?.price ?? 0);
    const baggageFee = this.baggageInfo?.price ?? 0;
    this.feeAmount = Math.max(0, this.totalAmount - this.baseFare - baggageFee);

    const payment = booking.payment ?? {};
    this.payerName = typeof payment['payerName'] === 'string' ? payment['payerName'] : this.payerName;
    this.transactionRef = typeof payment['transactionRef'] === 'string' ? payment['transactionRef'] : this.transactionRef;

    this.startCountdown();
    this.autoExpireIfNeeded();
  }

  get statusText(): string {
    if (this.bookingStatus === 'processing') return 'Đang chờ đối soát';
    if (this.bookingStatus === 'paid' || this.bookingStatus === 'issued') return 'Đã thanh toán';
    if (this.bookingStatus === 'failed') return 'Thanh toán thất bại';
    if (this.bookingStatus === 'expired') return 'Hết hạn thanh toán';
    if (this.bookingStatus === 'cancelled') return 'Đã hủy';
    return 'Chờ thanh toán';
  }

  get canConfirmPayment(): boolean {
    const ref = this.transactionRef.trim();
    const payer = this.payerName.trim();
    return this.bookingStatus === 'pending'
      && this.remainingSeconds() > 0
      && !this.isUpdatingStatus
      && ref.length >= 6
      && payer.length >= 3
      && this.hasConfirmedTransfer;
  }

  get seatTypeLabel(): string {
    if (this.seatType === 'business') return 'Thương gia';
    if (this.seatType === 'economy') return 'Phổ thông';
    return this.seatType ? this.seatType : 'Chưa xác định';
  }

  get baggageLabel(): string {
    if (!this.baggageInfo) return 'Không mua thêm';
    return this.baggageInfo.name;
  }

  get baggageFee(): number {
    return this.baggageInfo?.price ?? 0;
  }

  confirmPaid(): void {
    if (!this.canConfirmPayment) {
      this.statusMessage = 'Vui lòng nhập đủ thông tin và xác nhận bạn đã chuyển khoản.';
      return;
    }

    this.updateStatus('processing', 'Hệ thống đã tiếp nhận thông tin chuyển khoản và chuyển đơn sang bước đối soát.', {
      transactionRef: this.transactionRef.trim(),
      payerName: this.payerName.trim(),
      submittedAt: new Date().toISOString()
    });
  }

  refreshBooking(): void {
    if (!this.ticketCode) return;
    this.isLoading = true;

    this.bookingApiService.getBooking(this.ticketCode).subscribe({
      next: (booking: BookingRecord) => {
        this.populateTicketData(booking);
        this.bookingService.setData('bookingSnapshot', booking);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Không thể làm mới trạng thái booking:', error);
        this.isLoading = false;
      }
    });
  }

  private updateStatus(
    nextStatus: string,
    successMessage: string,
    paymentExtras: Record<string, unknown> = {},
    allowLegacyFallback: boolean = true
  ): void {
    if (!this.ticketCode) return;
    this.isUpdatingStatus = true;

    const snapshot = this.bookingService.getData('bookingSnapshot');
    const currentPayment = snapshot?.payment && typeof snapshot.payment === 'object' ? snapshot.payment : {};
    const mergedPayment = {
      ...currentPayment,
      ...paymentExtras,
    };

    this.bookingApiService.updateBookingStatus(this.ticketCode, nextStatus, mergedPayment).subscribe({
      next: (booking: BookingRecord) => {
        const bookingPayment: any = booking.payment ?? {};
        const mergedBooking = {
          ...booking,
          payment: {
            ...(booking.payment ?? {}),
            ...mergedPayment,
          }
        };

        this.populateTicketData(mergedBooking);
        this.bookingService.setData('bookingSnapshot', mergedBooking);
        this.statusMessage = bookingPayment.emailSent === true
          ? `${successMessage} Email thông báo đã được gửi tới ${this.ticketInfo.email}.`
          : `${successMessage} Hệ thống mail chưa được cấu hình nên chưa thể gửi email tự động.`;
        this.isUpdatingStatus = false;

        if (nextStatus === 'paid' || nextStatus === 'issued' || nextStatus === 'failed' || nextStatus === 'expired') {
          this.router.navigate(['/ket-qua-thanh-toan', this.ticketCode]);
        }
      },
      error: (error) => {
        const message = error?.error?.message ?? 'Cập nhật trạng thái thanh toán thất bại.';

        // Some older backend instances may reject 'processing'.
        // Fallback to 'paid' to keep the payment flow unblocked for users.
        if (allowLegacyFallback && nextStatus === 'processing' && /khong hop le|không hợp lệ/i.test(message)) {
          this.updateStatus('paid', successMessage, paymentExtras, false);
          return;
        }

        this.statusMessage = message;
        this.isUpdatingStatus = false;
      }
    });
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.updateCountdownText();
    this.countdownTimer = setInterval(() => this.updateCountdownText(), 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private remainingSeconds(): number {
    const ms = this.paymentDeadline.getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }

  private updateCountdownText(): void {
    if (!this.paymentDeadline) {
      this.countdownText = '';
      return;
    }

    const total = this.remainingSeconds();
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    this.countdownText = `${mm}:${ss}`;

    if (total === 0) {
      this.autoExpireIfNeeded();
    }
  }

  private autoExpireIfNeeded(): void {
    if (this.bookingStatus === 'pending' && this.remainingSeconds() === 0 && !this.isUpdatingStatus) {
      this.updateStatus('expired', 'Mã thanh toán đã hết hạn. Vui lòng đặt lại vé để tiếp tục.');
    }
  }

  copyAmount(): void {
    navigator.clipboard.writeText(String(this.totalAmount)).then(() => {
      this.copiedField = 'amount';
      setTimeout(() => { this.copiedField = ''; }, 1500);
    }).catch(() => {
      this.statusMessage = 'Không thể sao chép số tiền. Vui lòng sao chép thủ công.';
    });
  }

  copyTransferContent(): void {
    navigator.clipboard.writeText(this.transferContent()).then(() => {
      this.copiedField = 'content';
      setTimeout(() => { this.copiedField = ''; }, 1500);
    }).catch(() => {
      this.statusMessage = 'Không thể sao chép nội dung chuyển khoản. Vui lòng sao chép thủ công.';
    });
  }

  transferContent(): string {
    return `SKYLINE ${this.ticketCode}`;
  }

  get qrImageUrl(): string {
    const accountName = encodeURIComponent(this.bankInfo.accountName);
    const addInfo = encodeURIComponent(this.transferContent());
    return `https://img.vietqr.io/image/${this.bankInfo.bankCode}-${this.bankInfo.accountNumber}-compact2.png?amount=${this.totalAmount}&addInfo=${addInfo}&accountName=${accountName}`;
  }

  goToResult(): void {
    if (!this.ticketCode) return;
    this.router.navigate(['/ket-qua-thanh-toan', this.ticketCode]);
  }

  timeHM(iso?: string) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return ''; }
  }

  dateVN(iso?: string) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }
}