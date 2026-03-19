import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
import { TicketService } from '../services/ticket.service';
import { catchError, forkJoin, of } from 'rxjs';
import { TicketApiService, Flight } from '../services/ticket-api.service';

type SeatKind = 'economy' | 'business';

interface SeatLayoutItem {
  id: string;
  label: string;
  seatType: SeatKind;
  cssClass: 'seat-economy' | 'seat-business';
  top: number;
  left: string;
}

@Component({
  selector: 'app-seat-selection',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './seat-selection.html',
  styleUrls: ['./seat-selection.css']
})
export class SeatSelection implements OnInit {

  selectedSeat: string | null = null;
  selectedSeatType: string | null = null;

  currentUser: UserWithoutPassword | null = null;
  selectedFlightId: string | null = null;
  occupiedSeats = signal<string[]>([]);
  seats: SeatLayoutItem[] = this.buildSeatLayout();

  selectedFlight = signal<Flight | null>(null);
  isLoading = signal(true);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private ticketService: TicketService,
    private ticketApiService: TicketApiService,
  ) { }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.initializeSelectionContext();
    this.loadSeatSelectionData();
  }

  selectSeat(seatId: string, seatType: string) {
    if (this.isSeatOccupied(seatId)) {
      alert('Ghế này đã có người đặt. Vui lòng chọn ghế khác.');
      return;
    }

    if (this.selectedSeat === seatId) {
      this.selectedSeat = null;
      this.selectedSeatType = null;
    } else {
      this.selectedSeat = seatId;
      this.selectedSeatType = seatType;
    }
  }

  private resolveSeatType(seatCode: string | null): string | null {
    if (!seatCode) {
      return null;
    }

    const matchedSeat = this.seats.find((seat) => seat.id === seatCode);

    return matchedSeat?.seatType || null;
  }
  tiepTuc() {
    if (!this.selectedSeat) {
      alert('Vui lòng chọn ghế trước khi tiếp tục.');
      return;
    }

    this.ticketService.setData('seat', this.selectedSeat);
    this.ticketService.setData('selectedSeat', this.selectedSeat);
    this.ticketService.setData('selectedSeatType', this.selectedSeatType);

    this.router.navigate(['/baggage-selection'], {
      queryParams: {
        flightId: this.selectedFlightId,
        seat: this.selectedSeat,
        type: this.selectedSeatType
      }
    });
  }

  quayLai() {
    this.router.navigate(['/chon-chuyen-bay', this.selectedFlightId]);
  }

  isSeatOccupied(seatId: string): boolean {
    return this.occupiedSeats().includes(this.normalizeSeatCode(seatId));
  }

  trackBySeat(_index: number, seat: SeatLayoutItem): string {
    return seat.id;
  }

  private buildSeatLayout(): SeatLayoutItem[] {
    const businessRows = [495, 558, 621, 684, 747];
    const economyRows = [826, 876, 926, 976, 1026, 1114, 1164, 1214, 1264, 1314, 1402, 1452, 1502, 1552, 1602, 1690, 1740, 1790, 1840, 1890, 1978, 2028, 2078, 2128];
    const seats: SeatLayoutItem[] = [];

    businessRows.forEach((top, rowIndex) => {
      const rowNumber = rowIndex + 1;
      ['A', 'B', 'C'].forEach((column, columnIndex) => {
        seats.push({
          id: `${column}${String(rowNumber).padStart(2, '0')}`,
          label: `${column}${String(rowNumber).padStart(2, '0')}`,
          seatType: 'business',
          cssClass: 'seat-business',
          top,
          left: ['38.5%', '48.5%', '58.5%'][columnIndex],
        });
      });
    });

    economyRows.forEach((top, rowIndex) => {
      const rowNumber = rowIndex + 6;
      ['A', 'B', 'C', 'D'].forEach((column, columnIndex) => {
        seats.push({
          id: `${column}${String(rowNumber).padStart(2, '0')}`,
          label: `${column}${String(rowNumber).padStart(2, '0')}`,
          seatType: 'economy',
          cssClass: 'seat-economy',
          top,
          left: ['38.5%', '44.5%', '53.5%', '59.5%'][columnIndex],
        });
      });
    });

    return seats;
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
      return `${dd} Thg ${mm}`;
    } catch { return ''; }
  }

  economyPriceText(): string {
    return this.formatMoney(this.resolveCabinPrice('economy'));
  }

  businessPriceText(): string {
    return this.formatMoney(this.resolveCabinPrice('business'));
  }

  private resolveCabinPrice(cabin: 'economy' | 'business'): number | null {
    const flight = this.selectedFlight();
    if (!flight) {
      return null;
    }

    const storedFlight =
      this.ticketService.getData<Record<string, unknown>>('flight') ||
      this.ticketService.getData<Record<string, unknown>>('selectedFlight') ||
      {};
    const directPrice = this.getDirectCabinPrice(cabin, [flight, storedFlight]);
    if (directPrice !== null) return directPrice;

    const optionPrice = this.getCabinPriceFromFareOptions(cabin, [flight, storedFlight]);
    if (optionPrice !== null) return optionPrice;

    return null;
  }

  private initializeSelectionContext(): void {
    const cachedFlight =
      this.ticketService.getData<{ id?: string; flightId?: string }>('flight') ||
      this.ticketService.getData<{ id?: string; flightId?: string }>('selectedFlight');
    const cachedFlightId = cachedFlight?.id || cachedFlight?.flightId || this.ticketService.getData<string>('selectedFlightId');

    this.selectedFlightId =
      this.route.snapshot.paramMap.get('flightId') ||
      this.route.snapshot.queryParamMap.get('flightId') ||
      cachedFlightId ||
      null;
  }

  private loadSeatSelectionData(): void {
    if (!this.selectedFlightId) {
      this.isLoading.set(false);
      return;
    }

    const cachedFlight =
      this.ticketService.getData<{ id?: string; flightId?: string }>('flight') ||
      this.ticketService.getData<{ id?: string; flightId?: string }>('selectedFlight');
    const flightFallback = cachedFlight && (cachedFlight?.id === this.selectedFlightId || cachedFlight?.flightId === this.selectedFlightId)
      ? cachedFlight as Flight
      : null;

    const savedSeat = this.normalizeSeatCode(this.ticketService.getData<string>('selectedSeat'));
    const savedSeatType = this.ticketService.getData<string>('selectedSeatType');

    forkJoin({
      flight: this.ticketApiService.getFlightById(this.selectedFlightId).pipe(
        catchError((error) => {
          console.error('Lỗi tải chi tiết chuyến bay:', error);
          return of(flightFallback);
        })
      ),
      occupiedSeats: this.ticketApiService.getOccupiedSeats(this.selectedFlightId).pipe(
        catchError((error) => {
          console.error('Lỗi tải danh sách ghế đã đặt:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ flight, occupiedSeats }) => {
        const normalizedOccupiedSeats = occupiedSeats.map((seat) => this.normalizeSeatCode(seat)).filter(Boolean);

        this.selectedFlight.set(flight ?? null);
        this.occupiedSeats.set(Array.from(new Set(normalizedOccupiedSeats)));

        if (flight) {
          this.ticketService.setData('flight', flight);
        }
        this.ticketService.setData('selectedFlightId', this.selectedFlightId);

        if (savedSeat && !this.occupiedSeats().includes(savedSeat)) {
          this.selectedSeat = savedSeat;
          this.selectedSeatType = savedSeatType || this.resolveSeatType(savedSeat);
        } else {
          this.selectedSeat = null;
          this.selectedSeatType = null;
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu ghế/chuyến bay:', err);
        this.isLoading.set(false);
      }
    });
  }

  private getDirectCabinPrice(cabin: 'economy' | 'business', sources: any[]): number | null {
    const candidateKeys = cabin === 'economy'
      ? ['priceEconomy', 'economyPrice']
      : ['priceBusiness', 'businessPrice', 'priceBussiness'];

    for (const source of sources) {
      for (const key of candidateKeys) {
        const direct = this.toPositiveNumber(source?.[key]);
        if (direct !== null) return direct;

        const inDetails = this.toPositiveNumber(source?.details?.[key]);
        if (inDetails !== null) return inDetails;
      }
    }

    return null;
  }

  private getCabinPriceFromFareOptions(cabin: 'economy' | 'business', sources: any[]): number | null {
    for (const source of sources) {
      const options = Array.isArray(source?.details?.fare_options) ? source.details.fare_options : [];
      for (const option of options) {
        const type = String(option?.type || option?.class || '').toLowerCase();
        const isMatched = cabin === 'business'
          ? type.includes('business')
          : type.includes('economy') && !type.includes('premium');

        if (!isMatched) continue;

        const farePrice = this.toPositiveNumber(option?.price);
        if (farePrice !== null) return farePrice;
      }
    }

    return null;
  }

  private toPositiveNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private normalizeSeatCode(value: unknown): string {
    const compact = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!compact) return '';

    // Support both seat formats: A7 / A07 and 7A / 07A.
    const letterFirst = compact.match(/^([A-Z])(\d{1,2})$/);
    if (letterFirst) {
      const [, column, row] = letterFirst;
      return `${column}${row.padStart(2, '0')}`;
    }

    const rowFirst = compact.match(/^(\d{1,2})([A-Z])$/);
    if (rowFirst) {
      const [, row, column] = rowFirst;
      return `${column}${row.padStart(2, '0')}`;
    }

    return compact;
  }

  private formatMoney(value: number | null): string {
    if (value == null) {
      return 'Đang cập nhật';
    }

    const currency = this.selectedFlight()?.currency || 'VND';
    try {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'VND' ? 0 : 2,
      }).format(value);
    } catch {
      return `${value.toLocaleString('vi-VN')} ${currency}`;
    }
  }

}

