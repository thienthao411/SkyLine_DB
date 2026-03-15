import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BookingService } from '../services/booking.service';

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
  selector: 'app-seat-selection',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule
  ],
  templateUrl: './seat-selection.html',
  styleUrls: ['./seat-selection.css']
})
export class SeatSelection implements OnInit {

  selectedSeat: string | null = null;
  selectedSeatType: string | null = null;

  currentUser: UserWithoutPassword | null = null;
  selectedFlightId: string | null = null;

  selectedFlight = signal<Flight | null>(null);
  isLoading = signal(true);

  chooseSeat(selectedSeat: string, seatType: string) {
    if (!this.selectedFlight()) {
      console.error('Chưa có chuyến bay để chọn ghế!');
      return;
    }
  
    this.bookingService.setData('flight', this.selectedFlight());
    this.bookingService.setData('seat', selectedSeat);
    this.bookingService.setData('seatType', seatType);
  
    this.router.navigate(['/confirmation']);
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private bookingService: BookingService,
  ) { }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.selectedFlightId = this.route.snapshot.paramMap.get('flightId');

    if (this.selectedFlightId) {
      console.log('Đang chọn ghế cho chuyến bay:', this.selectedFlightId);

      this.http.get('assets/data/flight-search-sampledata.json').subscribe({
        next: (raw: any) => {
          const all = this.normalizeFlights(raw);
          const f = all.find(x => String(x.id) === String(this.selectedFlightId)) ?? null;
          this.selectedFlight.set(f);
          this.isLoading.set(false);
          if (!f) console.error('Không tìm thấy chuyến bay!');
        },
        error: (err) => {
          console.error('Lỗi tải dữ liệu chuyến bay:', err);
          this.isLoading.set(false);
        }
      });
    } else {
      console.error('Không có ID chuyến bay!');
      this.isLoading.set(false);
    }
  }

  selectSeat(seatId: string, seatType: string) {
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

  private normalizeFlights(data: any): Flight[] {
    const cur = data?.meta?.currency ?? 'VND';
    const list = Array.isArray(data) ? data : (data?.flights ?? []);
    const pick = (o: any, keys: string[], def: any = '') => {
      for (const k of keys) {
        try {
          const v = k.includes('.') ? k.split('.').reduce((x: any, kk) => x?.[kk], o) : o?.[k];
          if (v !== undefined && v !== null && v !== '') return v;
        } catch { }
      }
      return def;
    };
    return (list as any[]).map(x => {
      const departISO = String(pick(x, ['departTime', 'depart_time', 'dep_time', 'depart', 'departISO', 'depart.time']));
      const arriveISO = String(pick(x, ['arriveTime', 'arrive_time', 'arr_time', 'arrive', 'arriveISO', 'arrive.time']));
      const date = String(pick(x, ['date', 'flight_date'], departISO ? departISO.slice(0, 10) : ''));
      const from = String(pick(x, ['from', 'origin', 'from_code', 'route.from'])).toUpperCase();
      const to = String(pick(x, ['to', 'destination', 'to_code', 'route.to'])).toUpperCase();
      const price = Number(pick(x, ['price', 'fare', 'amount', 'total', 'base_price'], 0));
      const duration = Number(pick(x, ['durationMin', 'duration_min', 'duration', 'mins'], 0));
      return {
        id: String(pick(x, ['id'], `${pick(x, ['flightNo', 'number', 'flight_no'], 'XX000')}-${date}`)),
        airline: String(pick(x, ['airline', 'carrier', 'airline_name'], 'Unknown')),
        flightNo: String(pick(x, ['flightNo', 'number', 'flight_no'], 'XX000')),
        from, to, date,
        departTime: departISO,
        arriveTime: arriveISO,
        durationMin: duration,
        price,
        currency: (String(pick(x, ['currency'], cur)) as 'VND' | 'USD'),
        seatsLeft: Number(pick(x, ['seatsLeft', 'seats_left', 'seats_remaining'], 0)),
        cabin: (pick(x, ['cabin', 'class'], 'Economy') as Cabin),
        details: x.details ?? x
      };
    });
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

chooseFlight(flight: any, selectedSeat: string) {
  this.bookingService.setData('flight', flight);
  this.bookingService.setData('seat', selectedSeat);
  this.router.navigate(['/confirmation']);
}

}