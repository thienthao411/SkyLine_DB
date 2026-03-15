import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
export { FlightSelectionComponent as FlightSelection } from './flight-selection';
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

function normalizeFlights(data: any): Flight[] {
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

@Component({
  selector: 'app-flight-selection',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './flight-selection.html',
  styleUrls: ['./flight-selection.css']
})
export class FlightSelectionComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private bookingService = inject(BookingService);

  isLoading = signal(true);
  loadError = signal<string | null>(null);
  flight = signal<Flight | null>(null);

  private readonly STATIC_CABINS = ['Phổ thông', 'Thương gia'];

  constructor() {
    console.log('Flight chọn:', this.flight());
    const id = this.route.snapshot.paramMap.get('id')!;
    this.http.get('assets/data/flight-search-sampledata.json').subscribe({
      next: raw => {
        const all = normalizeFlights(raw);
        const f = all.find(x => String(x.id) === String(id)) ?? null;
        this.flight.set(f);
        this.bookingService.setData('flight', this.flight());
        this.isLoading.set(false);
        if (!f) this.loadError.set('Không tìm thấy chuyến bay.');
      },
      error: () => { this.isLoading.set(false); this.loadError.set('Lỗi tải dữ liệu.'); }
    });
  }

  goBack() {
    const st = (history.state && (history.state as any).search) || null;
    if (st) {
      this.router.navigate(['/tim-chuyen-bay'], { state: { search: st } });
    } else {
      this.router.navigate(['/tim-chuyen-bay']);
    }
  }

  goChooseCabin() {
    const id = this.flight()?.id;
    const st = (history.state && (history.state as any).search) || null;
    this.router.navigate(['/seat-selection', id ?? ''], { state: { search: st } });
  }

  getCarrierCode(f: Flight) {
    const code = (f as any)?.details?.airline_code?.toUpperCase?.();
    if (code) return code;
    const initials = (f.airline ?? '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();
    return initials || '??';
  }

  timeHM(iso?: string) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return ''; }
  }

  dateVN(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear();
    return `${wd}, ${dd}/${mm}/${yyyy}`;
  }

  durationStr(mins?: number) {
    if (mins == null) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return `${h}h${String(m).padStart(2, '0')}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  timeRangeText(f: Flight | null): string {
    if (!f) return '—';
    const start = this.timeHM(f.departTime);
    const end = this.timeHM(f.arriveTime);
    const dur = this.durationStr(f.durationMin);
    return `${start} – ${end} (${dur})`;
  }

  cabinListText(): string {
    return this.STATIC_CABINS.join(', ');
  }

  priceStr(v?: number, cur = 'VND', style: 'symbol' | 'code' = 'code') {
    if (v == null) return '';
    try {
      if (cur === 'VND') {
        return style === 'symbol'
          ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v)
          : `${v.toLocaleString('vi-VN')} VND`;
      }
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v);
    } catch { return `${v.toLocaleString('vi-VN')} ${cur}`; }
  }

  hasPromo(f: Flight) { return !!(f as any)?.details?.promo_code; }
  oldPrice(f: Flight) { return this.hasPromo(f) ? Math.round((f.price * 1.1) / 1000) * 1000 : null; }

  promo = computed(() => this.flight()?.details?.promo_code ?? null);

  itinerary = computed(() => {
    const f = this.flight();
    const legs = f?.details?.itinerary;
    if (Array.isArray(legs) && legs.length) return legs as any[];
    if (!f) return [{
      from: '', to: '', departTime: '', arriveTime: ''
    }];
    return [{
      from: f.from, to: f.to,
      departTime: f.departTime, arriveTime: f.arriveTime,
      flightNo: f.flightNo, airline: f.airline
    }];
  });

  legDurationMin(a?: string, b?: string) {
    if (!a || !b) return 0;
    const t1 = new Date(a).getTime();
    const t2 = new Date(b).getTime();
    if (isNaN(t1) || isNaN(t2)) return 0;
    return Math.max(0, Math.round((t2 - t1) / 60000));
  }

  baggageCarryOn = computed(() => this.flight()?.details?.baggage?.carryOn ?? null);
  baggageChecked = computed(() => this.flight()?.details?.baggage?.checked ?? null);
  mealText = computed(() => {
    const v = this.flight()?.details?.meal;
    if (v === true) return 'Có';
    if (v === false) return 'Không';
    return 'Theo hãng';
  });
  wifiText = computed(() => {
    const v = this.flight()?.details?.wifi;
    if (v === true) return 'Có';
    if (v === false) return 'Không';
    return 'Theo hãng';
  });

  terminalFrom = computed(() => this.flight()?.details?.terminalFrom ?? null);
  terminalTo = computed(() => this.flight()?.details?.terminalTo ?? null);
  gate = computed(() => this.flight()?.details?.gate ?? null);
  aircraft = computed(() => this.flight()?.details?.aircraft ?? null);

  perks = computed<string[]>(() => {
    const p = this.flight()?.details?.perks;
    if (Array.isArray(p)) return p;
    return ['Hành lý xách tay 7kg', 'Miễn phí đổi lịch trong 24h (nếu có)', 'Chọn chỗ tiêu chuẩn'];
  });

  airportName(code?: string | null): string {
    const MAP: Record<string, string> = {
      SGN: 'Sân bay Tân Sơn Nhất',
      HAN: 'Sân bay Nội Bài',
      DAN: 'Sân bay Đà Nẵng',
      CXR: 'Sân bay Cam Ranh',
      PQC: 'Sân bay Phú Quốc',
    };
    if (!code) return '—';
    return MAP[code.toUpperCase()] ?? code.toUpperCase();
  }

  stopsText(): string {
    return this.flight()?.details?.stops || 'Bay thẳng';
  }

  private readonly logoByCode: Record<string, string> = {
    VN: 'https://upload.wikimedia.org/wikipedia/vi/b/bc/Vietnam_Airlines_logo.svg',
    VJ: 'https://upload.wikimedia.org/wikipedia/commons/1/19/VietJet_Air_logo.svg',
    QH: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Bamboo_Airways_Logo.svg',
    BL: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Logo_h%C3%A3ng_Pacific_Airlines.svg',
    VU: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Vietravel_Airlines_Logo.png',
  };

  logoOf(f: any): string | null {
    if ((f as any)?._logoError) return null;
    const byData = f?.details?.logo?.trim?.();
    if (byData) return byData;
    const code = (f?.details?.airline_code || f?.airline_code || '').toUpperCase();
    return this.logoByCode[code] ?? null;
  }
}
