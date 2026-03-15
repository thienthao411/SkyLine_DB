import { Component, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { BookingService } from '../services/booking.service';

const TAX_RATE = 0.1;

type Cabin = 'Economy' | 'Premium Economy' | 'Business';
export interface Flight {
  id: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  date: string;
  departTime: string;
  arriveTime: string;
  durationMin: number;
  price: number;
  currency: 'VND' | 'USD';
  seatsLeft: number;
  cabin: Cabin;
  details?: any;
}

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmation.html',
  styleUrls: ['./confirmation.css'],
})
export class Confirmation {
  private bookingService = inject(BookingService);
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
    if (!form.valid) { this.showPaymentAlert.set(true); return; }

    this.bookingService.setData('payment', {
      method: this.paymentMethod(),
      details: form.value
    });

    this.bookingService.setData('totalAmount', this.totalPrice());
    this.bookingService.setData('bookingDate', new Date().toISOString());

    const flightNo = this.flight()?.flightNo ?? 'BK';
    const randomCode = Date.now().toString().slice(-6);
    const tempTicketCode = `${flightNo}-${randomCode}`;
    this.bookingService.setData('ticketCode', tempTicketCode);

    this.router.navigate(['/checkout']);
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