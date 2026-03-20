import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
export { FlightSelectionComponent as FlightSelection } from './flight-selection';
import { TicketService } from '../services/ticket.service';
import { TicketApiService } from '../services/ticket-api.service';

type Cabin = 'Economy' | 'Premium Economy' | 'Business';

export interface Flight {
  id: string;
  airlineId?: string;
  airlineCode?: string;
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
  economyPrice?: number;
  businessPrice?: number;
  details?: any;
}

interface ApiAirlineLogo {
  _id?: string;
  airlineCode?: string;
  airlineName?: string;
  img?: string;
}

@Component({
  selector: 'app-flight-selection',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './flight-selection.html',
  styleUrls: ['./flight-selection.css']
})
export class FlightSelectionComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private ticketService = inject(TicketService);
  private ticketApiService = inject(TicketApiService);
  private readonly apiBaseUrl = 'http://localhost:5000/api';
  private airlineLogoByCode = signal<Record<string, string>>({});
  private airlineLogoByName = signal<Record<string, string>>({});
  private airlineNameByCode = signal<Record<string, string>>({});
  private airlineNameById = signal<Record<string, string>>({});

  isLoading = signal(true);
  loadError = signal<string | null>(null);
  flight = signal<Flight | null>(null);

  private readonly STATIC_CABINS = ['Phổ thông', 'Thương gia'];

  constructor() {
    console.log('Flight chọn:', this.flight());
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadAirlineLogos();
    this.ticketApiService.getFlightById(id).subscribe({
      next: (flight) => {
        this.flight.set(flight as Flight);
        this.ticketService.setData('flight', flight);
        this.isLoading.set(false);
        if (!flight) this.loadError.set('Không tìm thấy chuyến bay.');
      },
      error: () => { this.isLoading.set(false); this.loadError.set('Lỗi tải dữ liệu.'); }
    });
  }

  private loadAirlineLogos(): void {
    this.http.get<ApiAirlineLogo[]>(`${this.apiBaseUrl}/airlines`).pipe(
      map((airlines) => {
        const lookupByCode: Record<string, string> = {};
        const lookupByName: Record<string, string> = {};
        const nameByCode: Record<string, string> = {};
        const nameById: Record<string, string> = {};

        (Array.isArray(airlines) ? airlines : []).forEach((airline) => {
          const id = String(airline?._id || '').trim();
          const code = String(airline?.airlineCode || '').trim().toUpperCase();
          const name = String(airline?.airlineName || '').trim();
          const img = String(airline?.img || '').trim();

          if (id && name) {
            nameById[id] = name;
          }

          if (code && name) {
            nameByCode[code] = name;
          }

          if (code && img) {
            lookupByCode[code] = img;
          }

          if (name && img) {
            lookupByName[this.normalizeAirlineKey(name)] = img;

            const canonicalName = this.canonicalAirlineName(name);
            if (canonicalName) {
              lookupByName[this.normalizeAirlineKey(canonicalName)] = img;
            }
          }
        });

        return { lookupByCode, lookupByName, nameByCode, nameById };
      })
    ).subscribe({
      next: ({ lookupByCode, lookupByName, nameByCode, nameById }) => {
        this.airlineLogoByCode.set(lookupByCode);
        this.airlineLogoByName.set(lookupByName);
        this.airlineNameByCode.set(nameByCode);
        this.airlineNameById.set(nameById);
      },
      error: (err) => {
        console.warn('Khong tai duoc logo airline tu API:', err);
        this.airlineLogoByCode.set({});
        this.airlineLogoByName.set({});
        this.airlineNameByCode.set({});
        this.airlineNameById.set({});
      }
    });
  }

  private normalizeAirlineKey(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private canonicalAirlineName(value: string): string {
    const normalized = this.normalizeAirlineKey(value);
    const aliases: Record<string, string> = {
      'vasco': 'VASCO',
      'vasco airlines': 'VASCO',
      'vasco airline': 'VASCO',
      'vietnam airlines': 'Vietnam Airlines',
      'vietjet': 'Vietjet Air',
      'bamboo airways': 'Bamboo Airways',
      'vietravel airlines': 'Vietravel Airlines',
      'pacific airlines': 'Pacific Airlines'
    };

    return aliases[normalized] || String(value || '').trim();
  }

  displayAirlineName(f: Flight | null): string {
    if (!f) return 'Unknown';

    const airlineId = String((f as any)?.airlineId || (f as any)?.details?.airline_id || '').trim();
    if (airlineId && this.airlineNameById()[airlineId]) {
      return this.canonicalAirlineName(this.airlineNameById()[airlineId]);
    }

    const code = this.resolveAirlineCode(f);
    if (code && this.airlineNameByCode()[code]) {
      return this.canonicalAirlineName(this.airlineNameByCode()[code]);
    }

    const rawName = String(f.airline || (f as any)?.details?.airline || '').trim();
    if (rawName && rawName.toLowerCase() !== 'unknown') {
      return this.canonicalAirlineName(rawName);
    }

    const fallbackByCode: Record<string, string> = {
      VN: 'Vietnam Airlines',
      VJ: 'Vietjet Air',
      QH: 'Bamboo Airways',
      '0V': 'VASCO',
      VU: 'Vietravel Airlines',
      BL: 'Pacific Airlines'
    };

    return fallbackByCode[code] || 'Unknown';
  }

  private resolveAirlineCode(f: Flight | null): string {
    if (!f) return '';

    const explicitCode = String((f as any)?.airlineCode || (f as any)?.details?.airline_code || '').trim().toUpperCase();
    if (explicitCode) return explicitCode;

    return String(f.flightNo || '').trim().toUpperCase().slice(0, 2);
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
    const code = this.resolveAirlineCode(f);
    if (code) return code;
    const initials = this.displayAirlineName(f).split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();
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

  logoOf(f: any): string | null {
    if ((f as any)?._logoError) return null;
    const byData = f?.details?.logo?.trim?.();
    if (byData) return byData;
    const code = this.resolveAirlineCode(f);
    const byCode = this.airlineLogoByCode()[code];
    if (byCode) return byCode;

    const rawName = this.displayAirlineName(f);
    const normalizedName = this.normalizeAirlineKey(rawName);
    const canonicalName = this.normalizeAirlineKey(this.canonicalAirlineName(rawName));

    return this.airlineLogoByName()[normalizedName] || this.airlineLogoByName()[canonicalName] || null;
  }
}
