import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
import { BookingService } from '../services/booking.service';
import { forkJoin } from 'rxjs';
import { BookingApiService, Flight } from '../services/booking-api.service';

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
    private bookingService: BookingService,
    private bookingApiService: BookingApiService,
  ) { }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.selectedFlightId = this.route.snapshot.paramMap.get('flightId');

    if (this.selectedFlightId) {
      forkJoin({
        flight: this.bookingApiService.getFlightById(this.selectedFlightId),
        occupiedSeats: this.bookingApiService.getOccupiedSeats(this.selectedFlightId)
      }).subscribe({
        next: ({ flight, occupiedSeats }) => {
          this.selectedFlight.set(flight);
          this.occupiedSeats.set(occupiedSeats);
          this.bookingService.setData('flight', flight);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Lỗi tải dữ liệu ghế/chuyến bay:', err);
          this.isLoading.set(false);
        }
      });
    } else {
      console.error('Không có ID chuyến bay!');
      this.isLoading.set(false);
    }
  }

  selectSeat(seatId: string, seatType: string) {
    if (this.isSeatOccupied(seatId)) {
      return;
    }

    console.log('Ghế đã chọn:', seatId, 'Loại:', seatType);

    if (this.selectedSeat === seatId) {
      this.selectedSeat = null;
      this.selectedSeatType = null;
    } else {
      this.selectedSeat = seatId;
      this.selectedSeatType = seatType;
    }
  }

  tiepTuc() {
    if (!this.selectedSeat) {
      alert('⚠️ Vui lòng chọn ghế trước khi tiếp tục!');
      return;
    }

    this.bookingService.setData('seat', this.selectedSeat);
    this.bookingService.setData('selectedSeat', this.selectedSeat);
    this.bookingService.setData('selectedSeatType', this.selectedSeatType);

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
    return this.occupiedSeats().includes(seatId);
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

}