import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
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
  selector: 'app-baggage-selection',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule
  ],
  templateUrl: './baggage-selection.html',
  styleUrls: ['./baggage-selection.css']
})
export class BaggageSelection implements OnInit {

  passengerForm: FormGroup;

  baggageOptions: any[] = [];
  selectedBaggage = signal<any>(null);

  isLoading = signal(true);
  selectedFlight = signal<Flight | null>(null);
  currentUser: UserWithoutPassword | null = null;

  selectedFlightId: string | null = null;
  selectedSeat: string | null = null;
  selectedSeatType: string | null = null;


  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private bookingService: BookingService
  ) {

    this.passengerForm = this.fb.group({
      salutation: ['Quý Ông', Validators.required],
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      idNumber: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.selectedFlightId = this.route.snapshot.queryParams['flightId'];
    this.selectedSeat = this.route.snapshot.queryParams['seat'];
    this.selectedSeatType = this.route.snapshot.queryParams['type'];
    this.currentUser = this.authService.getCurrentUser();

    let fullUserData: any = null;
    const fullUserRaw = localStorage.getItem('fullUserData');
    if (fullUserRaw) {
      fullUserData = JSON.parse(fullUserRaw);
    }

    if (this.currentUser) {
      this.passengerForm.patchValue({
        fullName: this.currentUser.name,
        email: this.currentUser.email
      });
    }

    if (fullUserData) {
      this.passengerForm.patchValue({
        phoneNumber: fullUserData.phone || '',
        dob: this.formatDateForInput(fullUserData.birthday),
        idNumber: fullUserData.passport || '',
        address: fullUserData.address || '',
        salutation: fullUserData.gender === 'Nữ' ? 'Quý Bà' : 'Quý Ông'
      });
    }

    if (this.selectedFlightId) {
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


    this.baggageOptions = [
      { name: '20kg', price: 230000, priceDisplay: '230.000đ' },
      { name: '30kg', price: 345000, priceDisplay: '345.000đ' },
      { name: '40kg', price: 460000, priceDisplay: '460.000đ' },
      { name: '50kg', price: 632500, priceDisplay: '632.500đ' },
      { name: '60kg', price: 747500, priceDisplay: '747.500đ' },
      { name: 'Hành lý quá khổ 20kg', price: 517500, priceDisplay: '517.500đ' },
      { name: 'Hành lý quá khổ 30kg', price: 632500, priceDisplay: '632.500đ' },
    ];
  }

  private formatDateForInput(dateStr: string): string {
    if (!dateStr || dateStr.split('/').length !== 3) {
      return '';
    }
    const parts = dateStr.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }


  get f() {
    return this.passengerForm.controls;
  }

  selectBaggage(option: any): void {
    if (this.selectedBaggage() === option) {
      this.selectedBaggage.set(null);
    } else {
      this.selectedBaggage.set(option);
    }
  }

  onSubmit(): void {
    if (this.passengerForm.valid) {
      console.log('Form Data:', this.passengerForm.value);

      const selectedBaggagePrice = this.selectedBaggage() ? this.selectedBaggage().price : 0;
      console.log('Baggage Price selected:', selectedBaggagePrice);

      this.bookingService.setData('passengerInfo', this.passengerForm.value);
      this.bookingService.setData('baggagePrice', selectedBaggagePrice);
      this.bookingService.setData('selectedFlight', this.selectedFlight());
      this.bookingService.setData('selectedSeat', this.selectedSeat);
      this.bookingService.setData('selectedSeatType', this.selectedSeatType);

      this.router.navigate(['/confirmation']);

    } else {
      this.passengerForm.markAllAsTouched();
      console.error('Form không hợp lệ.');
    }
  }

  quayLai(): void {
    if (this.selectedFlightId) {
      this.router.navigate(['/seat-selection', this.selectedFlightId]);
    } else {
      this.router.navigate(['/tim-chuyen-bay']);
    }
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
      const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${wd}, ${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }
}