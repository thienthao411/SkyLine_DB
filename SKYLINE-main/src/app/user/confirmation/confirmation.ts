import { Component, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingService } from '../services/booking.service';
import { BookingApiService, BookingRecord, Flight } from '../services/booking-api.service';

const TAX_RATE = 0.1;

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmation.html',
  styleUrls: ['./confirmation.css'],
})
export class Confirmation {
  private bookingService = inject(BookingService);
  private bookingApiService = inject(BookingApiService);
  private router = inject(Router);

  isLoading = signal(true);
  selectedFlight = signal<Flight | null>(null);
  selectedSeat: string | null = null;

  flight = signal<any>(null);
  seat = signal<string>('');
  seatType = signal<string>('');
  baggageFee = signal<number>(0);

  paymentMethod = signal<'credit' | 'google' | 'apple' | 'paypal'>('credit');
  nameOnCard = signal<string>('');
  cardNumber = signal<string>('');
  expiry = signal<string>('');
  cvv = signal<string>('');
  couponCode = signal<string>('');

  showPaymentAlert = signal(false);
  couponApplied = signal(false);
  showCouponAlert = signal<{ show: boolean; message: string }>({ show: false, message: '' });
  paymentAlertMessage = signal('Vui lòng nhập đầy đủ thông tin địa chỉ thanh toán.');
  isSubmitting = signal(false);

  @ViewChild('cardNameInput') cardNameInput!: ElementRef<HTMLInputElement>;

  basePrice = computed(() => this.flight()?.price ?? 0);
  taxesAndFees = computed(() => this.basePrice() * TAX_RATE);
  totalPrice = computed(() => this.basePrice() + this.taxesAndFees() + this.baggageFee());

  constructor() {
    const data = this.bookingService.getAllData();

    if (!data.flight || !data.seat) {
      this.router.navigate(['/chon-chuyen-bay']);
      this.isLoading.set(false);
    } else {
      this.flight.set({ ...data.flight });
      this.seat.set(data.selectedSeat);
      this.seatType.set(data.selectedSeatType ?? 'Standard');
      const baggagePrice = this.bookingService.getData('baggagePrice') ?? 0;
      this.baggageFee.set(baggagePrice);

      this.selectedFlight.set({ ...data.flight } as Flight);
      this.selectedSeat = data.selectedSeat;
      this.isLoading.set(false);
    }
  }

  flightName() { return this.flight()?.airline ?? ''; }
  flightPrice() { return this.basePrice(); }

  flightTime() {
    try {
      const d = new Date(this.flight()?.departTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const a = new Date(this.flight()?.arriveTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${d} – ${a}`;
    } catch { return 'N/A'; }
  }

  getTaxes() { return this.taxesAndFees(); }

  confirmPayment(form: NgForm) {
    if (!form.valid) {
      this.paymentAlertMessage.set('Vui lòng nhập đầy đủ thông tin thanh toán.');
      this.showPaymentAlert.set(true);
      return;
    }

    const passengerInfo = this.bookingService.getData('passengerInfo');
    if (!this.flight() || !this.seat() || !passengerInfo) {
      this.paymentAlertMessage.set('Thiếu dữ liệu đặt vé. Vui lòng quay lại bước trước.');
      this.showPaymentAlert.set(true);
      return;
    }

    const payment = {
      method: this.paymentMethod(),
      details: form.value
    };

    const bookingDate = new Date().toISOString();
    this.isSubmitting.set(true);

    this.bookingApiService.createBooking({
      flightId: this.flight()!.id,
      flight: this.flight()!,
      passengerInfo,
      seat: this.seat(),
      seatType: this.seatType(),
      baggageOption: this.bookingService.getData('baggageOption'),
      payment,
      totalAmount: this.totalPrice(),
      bookingDate
    }).subscribe({
      next: (booking: BookingRecord) => {
        this.bookingService.setData('payment', payment);
        this.bookingService.setData('totalAmount', booking.totalAmount);
        this.bookingService.setData('bookingDate', booking.bookingDate);
        this.bookingService.setData('ticketCode', booking.ticketCode);
        this.bookingService.setData('bookingSnapshot', booking);
        this.isSubmitting.set(false);
        this.router.navigate(['/checkout']);
      },
      error: (error: any) => {
        const message = error?.error?.message ?? 'Không thể tạo booking trên backend. Vui lòng thử lại.';
        this.paymentAlertMessage.set(message);
        this.showPaymentAlert.set(true);
        this.isSubmitting.set(false);
      }
    });
  }

  closeAlert() { this.showPaymentAlert.set(false); }

  applyCoupon() {
    if (this.couponApplied()) {
      this.showCouponAlert.set({ show: true, message: 'Bạn đã áp dụng mã giảm giá rồi.' });
      this.autoHideCouponAlert(); return;
    }

    const code = this.couponCode();
    if (!code) {
      this.showCouponAlert.set({ show: true, message: 'Vui lòng nhập mã giảm giá.' });
      this.autoHideCouponAlert(); return;
    }

    if (code === 'DISCOUNT10') {
      const oldPrice = this.flight()?.price ?? 0;
      if (!this.flight()?.originalPrice) {
        this.flight.update(f => f ? { ...f, originalPrice: oldPrice } : f);
      }
      const newPrice = oldPrice * 0.9;
      this.flight.update(f => f ? { ...f, price: newPrice } : f);

      this.couponApplied.set(true);
      this.showCouponAlert.set({ show: true, message: `Mã giảm giá áp dụng thành công! Giá sau voucher: ${newPrice}` });
    } else {
      this.showCouponAlert.set({ show: true, message: 'Mã giảm giá không hợp lệ.' });
    }

    this.autoHideCouponAlert();
  }

  private autoHideCouponAlert() {
    setTimeout(() => { this.showCouponAlert.set({ show: false, message: '' }); }, 3000);
  }

  backToBaggageSelection() {
    const flightId = this.flight()?.id;
    const seat = this.seat();
    const type = this.seatType();

    if (flightId) {
      this.router.navigate(['/baggage-selection'], {
        queryParams: {
          flightId: flightId,
          seat: seat,
          type: type
        }
      });
    } else {
      this.router.navigate(['/tim-chuyen-bay']);
    }
  }

  focusCardName(event: Event) { this.cardNameInput?.nativeElement?.focus(); }
  selectMethod(method: 'credit' | 'google' | 'apple' | 'paypal') { this.paymentMethod.set(method); }

  timeHM(iso?: string) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return ''; }
  }

  dateVN(iso?: string) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${wd}, ${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }
}