import { Component, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TicketService } from '../services/ticket.service';
import { TicketApiService, BookingRecord, Flight, BaggageOption } from '../services/ticket-api.service';
import { PromotionApiItem, PromotionApiModel, PromotionApiService } from '../../services/promotion-api.service';
import { AirlineApiModel, AirlineApiService } from '../../services/airline-api.service';

const TAX_RATE = 0.1;

interface AppliedPromotion {
  code: string;
  discountAmount: number;
  discountType: 'percentage' | 'amount';
  discountValue: number;
}

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmation.html',
  styleUrls: ['./confirmation.css'],
})
export class Confirmation {
  private ticketService = inject(TicketService);
  private ticketApiService = inject(TicketApiService);
  private promotionApi = inject(PromotionApiService);
  private airlineApi = inject(AirlineApiService);
  private router = inject(Router);

  isLoading = signal(true);
  selectedFlight = signal<Flight | null>(null);
  selectedSeat: string | null = null;

  flight = signal<any>(null);
  seat = signal<string>('');
  seatType = signal<string>('');
  baggageFee = signal<number>(0);

  paymentMethod = signal<'credit' | 'qrcode' | 'apple' | 'paypal'>('qrcode');
  nameOnCard = signal<string>('');
  cardNumber = signal<string>('');
  expiry = signal<string>('');
  cvv = signal<string>('');
  couponCode = signal<string>('');
  appliedPromotion = signal<AppliedPromotion | null>(null);

  showPaymentAlert = signal(false);
  couponApplied = signal(false);
  showCouponAlert = signal<{ show: boolean; message: string }>({ show: false, message: '' });
  paymentAlertMessage = signal('Vui lòng nhập đầy đủ thông tin địa chỉ thanh toán.');
  isSubmitting = signal(false);
  airlineLogoUrl = signal('/assets/media/mainLogo.png');

  @ViewChild('cardNameInput') cardNameInput!: ElementRef<HTMLInputElement>;

  basePrice = computed(() => this.flight()?.price ?? 0);
  taxesAndFees = computed(() => this.basePrice() * TAX_RATE);
  subtotalPrice = computed(() => this.basePrice() + this.taxesAndFees() + this.baggageFee());
  discountAmount = computed(() => this.appliedPromotion()?.discountAmount ?? 0);
  totalPrice = computed(() => Math.max(0, this.subtotalPrice() - this.discountAmount()));

  constructor() {
    const storedFlight = this.ticketService.getData<Flight>('flight') || this.ticketService.getData<Flight>('selectedFlight');
    const storedSeat = this.ticketService.getData<string>('selectedSeat') || this.ticketService.getData<string>('seat');
    const storedSeatType = this.ticketService.getData<string>('selectedSeatType') || 'Standard';

    if (!storedFlight || !storedSeat) {
      this.router.navigate(['/chon-chuyen-bay']);
      this.isLoading.set(false);
    } else {
      this.flight.set({ ...storedFlight });
      this.seat.set(storedSeat);
      this.seatType.set(storedSeatType);
      const baggagePrice = Number(this.ticketService.getData<number>('baggagePrice') ?? 0);
      this.baggageFee.set(baggagePrice);

      this.selectedFlight.set({ ...storedFlight });
      this.selectedSeat = storedSeat;
      this.isLoading.set(false);
      this.loadAirlineLogoForSelectedFlight();
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

    const passengerInfo = this.ticketService.getData<Record<string, unknown>>('passengerInfo');
    const selectedFlight = this.flight() as Flight | null;
    if (!selectedFlight || !this.seat() || !passengerInfo) {
      this.paymentAlertMessage.set('Thiếu dữ liệu đặt vé. Vui lòng quay lại bước trước.');
      this.showPaymentAlert.set(true);
      return;
    }

    const payment = {
      method: this.paymentMethod(),
      details: form.value,
      promotion: this.appliedPromotion()
    };

    const bookingDate = new Date().toISOString();
    this.isSubmitting.set(true);

    this.ticketApiService.createBooking({
      flightId: selectedFlight.id,
      flight: selectedFlight,
      passengerInfo,
      seat: this.seat(),
      seatType: this.seatType(),
      baggageOption: this.ticketService.getData<BaggageOption | null>('baggageOption'),
      payment,
      totalAmount: this.totalPrice(),
      bookingDate
    }).subscribe({
      next: (booking: BookingRecord) => {
        this.ticketService.setData('payment', payment);
        this.ticketService.setData('totalAmount', booking.totalAmount);
        this.ticketService.setData('promotion', this.appliedPromotion());
        this.ticketService.setData('bookingDate', booking.bookingDate);
        this.ticketService.setData('ticketCode', booking.ticketCode);
        this.ticketService.setData('bookingSnapshot', booking);
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
    const rawCode = this.couponCode();
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      this.showCouponAlert.set({ show: true, message: 'Vui lòng nhập mã giảm giá.' });
      this.autoHideCouponAlert(); return;
    }

    this.promotionApi.getAll().subscribe({
      next: (promotions) => {
        const result = this.resolvePromotionDiscount(promotions, code, this.subtotalPrice());

        if (!result) {
          this.couponApplied.set(false);
          this.appliedPromotion.set(null);
          this.showCouponAlert.set({ show: true, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
          this.autoHideCouponAlert();
          return;
        }

        this.appliedPromotion.set({
          code,
          discountAmount: result.discountAmount,
          discountType: result.discountType,
          discountValue: result.discountValue,
        });
        this.couponApplied.set(true);
        this.couponCode.set(code);

        this.showCouponAlert.set({
          show: true,
          message: `Áp dụng mã ${code} thành công. Giảm ${result.discountAmount.toLocaleString('vi-VN')} đ.`
        });
        this.autoHideCouponAlert();
      },
      error: () => {
        this.showCouponAlert.set({ show: true, message: 'Không thể kiểm tra mã giảm giá lúc này.' });
        this.autoHideCouponAlert();
      }
    });
  }

  private resolvePromotionDiscount(
    promotions: PromotionApiModel[],
    couponCode: string,
    subtotal: number
  ): { discountAmount: number; discountType: 'percentage' | 'amount'; discountValue: number } | null {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) return null;

    for (const promotion of promotions || []) {
      for (const item of promotion.items || []) {
        const itemCode = String(item.promoCode || '').trim().toUpperCase();
        if (!itemCode || itemCode !== normalizedCode) {
          continue;
        }

        if (!this.isPromotionActive(item)) {
          return null;
        }

        const minOrderValue = Number(item.minOrderValue || 0);
        if (minOrderValue > 0 && subtotal < minOrderValue) {
          return null;
        }

        const discountValue = Number(item.discountValueRaw || 0);
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
          return null;
        }

        const isPercent = String(item.ruleType || '').toLowerCase() === 'percentage';
        const beforeCap = isPercent
          ? subtotal * (discountValue / 100)
          : discountValue;

        const maxDiscount = Number(item.maxDiscountAmount || 0);
        const cappedDiscount = maxDiscount > 0 ? Math.min(beforeCap, maxDiscount) : beforeCap;
        const finalDiscount = Math.min(subtotal, Math.max(0, Math.round(cappedDiscount)));

        if (finalDiscount <= 0) {
          return null;
        }

        return {
          discountAmount: finalDiscount,
          discountType: isPercent ? 'percentage' : 'amount',
          discountValue,
        };
      }
    }

    return null;
  }

  private isPromotionActive(item: PromotionApiItem): boolean {
    const status = String(item.status || 'active').toLowerCase();
    if (['expired', 'inactive', 'draft'].includes(status)) {
      return false;
    }

    const now = new Date();
    const startRaw = item.startDate || item.applyTime?.from || '';
    const endRaw = item.endDate || item.applyTime?.to || '';

    const start = this.parseDateValue(startRaw);
    if (start && start > now) {
      return false;
    }

    const end = this.parseDateValue(endRaw);
    if (end && end < now) {
      return false;
    }

    return true;
  }

  private parseDateValue(value: string): Date | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const native = new Date(raw);
    if (!Number.isNaN(native.getTime())) {
      return native;
    }

    const parts = raw.replace(/-/g, '/').split('/').map((x) => Number(x));
    if (parts.length === 3 && parts.every((x) => Number.isFinite(x))) {
      const [d, m, y] = parts;
      const parsed = new Date(y, (m || 1) - 1, d || 1);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private loadAirlineLogoForSelectedFlight(): void {
    const currentFlight = this.flight();
    if (!currentFlight) {
      return;
    }

    this.airlineApi.getAll().subscribe({
      next: (airlines) => {
        const resolvedLogo = this.resolveAirlineLogo(currentFlight, airlines || []);
        if (resolvedLogo) {
          this.airlineLogoUrl.set(resolvedLogo);
        }
      },
      error: () => {
        this.airlineLogoUrl.set('/assets/media/mainLogo.png');
      }
    });
  }

  private resolveAirlineLogo(flight: Flight, airlines: AirlineApiModel[]): string {
    const list = Array.isArray(airlines) ? airlines : [];

    const airlineId = String((flight as any)?.airlineId || (flight as any)?.details?.airline_id || '').trim();
    if (airlineId) {
      const byId = list.find((item) => String(item?._id || '').trim() === airlineId);
      const logoById = this.pickAirlineLogo(byId);
      if (logoById) return logoById;
    }

    const airlineCode = String((flight as any)?.airlineCode || (flight as any)?.details?.airline_code || '').trim().toUpperCase();
    if (airlineCode) {
      const byCode = list.find((item) => String(item?.airlineCode || '').trim().toUpperCase() === airlineCode);
      const logoByCode = this.pickAirlineLogo(byCode);
      if (logoByCode) return logoByCode;
    }

    const airlineName = this.normalizeAirlineName(String((flight as any)?.airline || '').trim());
    if (airlineName) {
      const byName = list.find((item) => this.normalizeAirlineName(String(item?.airlineName || '').trim()) === airlineName);
      const logoByName = this.pickAirlineLogo(byName);
      if (logoByName) return logoByName;
    }

    return '/assets/media/mainLogo.png';
  }

  private pickAirlineLogo(airline?: AirlineApiModel): string {
    const logo = String(airline?.img || airline?.logo || '').trim();
    return logo || '';
  }

  private normalizeAirlineName(value: string): string {
    return String(value || '').trim().toLowerCase();
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
  selectMethod(method: 'credit' | 'qrcode' | 'apple' | 'paypal') { this.paymentMethod.set(method); }

  onCardNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Only allow letters and spaces
    const filtered = input.value.replace(/[^a-zA-Z\s]/g, '');
    if (input.value !== filtered) {
      input.value = filtered;
      this.nameOnCard.set(filtered);
    }
  }

  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Only allow digits
    const filtered = input.value.replace(/\D/g, '');
    if (input.value !== filtered) {
      input.value = filtered;
      this.cardNumber.set(filtered);
    }
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
      const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${wd}, ${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }

  formatExpiryForDisplay(): string {
    const value = this.expiry();
    if (!value) return '';

    const [year, month] = value.split('-');
    if (!year || !month) {
      return value;
    }

    return `${month}/${year}`;
  }

  onExpiryMonthChange(value: string): void {
    this.expiry.set(String(value || ''));
  }

  openExpiryPicker(input: HTMLInputElement): void {
    if (!input) return;

    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }

    input.focus();
    input.click();
  }
}

