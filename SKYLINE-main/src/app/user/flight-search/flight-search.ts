import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';

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
  cabin: 'Economy' | 'Premium Economy' | 'Business';
  details?: any;
}

type RawJson = { meta?: any; flights?: any[] } | any;

function normalizeFlights(data: RawJson): Flight[] {
  const cur = data?.meta?.currency ?? 'VND';
  const list = Array.isArray(data) ? data : (data?.flights ?? []);

  const pick = (obj: any, keys: string[], def: any = '') => {
    for (const k of keys) {
      try {
        const v = k.includes('.')
          ? k.split('.').reduce((o, kk) => o?.[kk], obj)
          : obj?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
      } catch { }
    }
    return def;
  };

  return (list as any[]).map(x => {
    const departISO = String(pick(x, ['departTime', 'depart_time', 'dep_time', 'depart', 'depart_at', 'departISO', 'depart_iso', 'depart.time']));
    const arriveISO = String(pick(x, ['arriveTime', 'arrive_time', 'arr_time', 'arrive', 'arrive_at', 'arriveISO', 'arrive_iso', 'arrive.time']));
    const date = String(pick(x, ['date', 'flight_date'], departISO ? departISO.slice(0, 10) : ''));

    const from = String(pick(x, ['from', 'origin', 'from_code', 'origin_code', 'route.from'])).toUpperCase();
    const to = String(pick(x, ['to', 'destination', 'to_code', 'destination_code', 'route.to'])).toUpperCase();

    const cabin = pick(x, ['cabin', 'class'], 'Economy');
    const price = Number(pick(x, ['price', 'fare', 'amount', 'total', 'base_price'], 0));

    return {
      id: String(pick(x, ['id'], `${pick(x, ['flightNo', 'number', 'flight_no'], 'XX000')}-${date}`)),
      airline: String(pick(x, ['airline', 'carrier', 'airline_name'], 'Unknown')),
      flightNo: String(pick(x, ['flightNo', 'number', 'flight_no'], 'XX000')),
      from, to,
      date,
      departTime: departISO,
      arriveTime: arriveISO,
      durationMin: Number(pick(x, ['durationMin', 'duration_min', 'duration', 'mins'], 0)),
      price,
      currency: (String(pick(x, ['currency'], cur)) as 'VND' | 'USD'),
      seatsLeft: Number(pick(x, ['seatsLeft', 'seats_left', 'seats_remaining'], 0)),
      cabin: (cabin as Flight['cabin']),
      details: x.details ?? x
    };
  });
}

@Component({
  selector: 'app-flight-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent, FooterComponent],
  templateUrl: './flight-search.html',
  styleUrls: ['./flight-search.css'],
})

export class FlightSearchComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor(private http: HttpClient) {
    const st = (history.state as any)?.search;
    if (st) this.applySearchState(st);

    const p = this.route.snapshot.queryParamMap;
    const qpTrip = (p.get('trip') as 'oneway' | 'round' | null) ?? null;
    const qpFrom = (p.get('from') ?? '').toUpperCase();
    const qpTo = (p.get('to') ?? '').toUpperCase();
    const qpDate = p.get('date') ?? '';

    if (qpTrip) this.tripType.set(qpTrip);
    if (qpFrom) this.from.set(qpFrom);
    if (qpTo) this.to.set(qpTo);
    if (qpDate) this.departDate.set(qpDate);

    this.fetchData(true);
  }

  private allFlights = signal<Flight[]>([]);
  isLoading = signal(false);
  loadError = signal<string | null>(null);
  hasSearched = signal(false);
  autoDateMsg = signal<string | null>(null);

  tripType = signal<'oneway' | 'round'>('oneway');
  from = signal<string>(''); to = signal<string>('');
  departDate = signal<string>('');
  rtFrom = signal<string>(''); rtTo = signal<string>(''); returnDate = signal<string>('');

  cabinOut = signal<Flight['cabin'] | ''>(''); showCabinOut = signal(false);
  cabinBack = signal<Flight['cabin'] | ''>(''); showCabinBack = signal(false);

  setCabinOut(c: Flight['cabin']) { this.cabinOut.set(c); this.showCabinOut.set(false); }
  setCabinBack(c: Flight['cabin']) { this.cabinBack.set(c); this.showCabinBack.set(false); }

  showPax = signal(false);
  adults = signal(1); children = signal(0); infants = signal(0);
  paxTotal = computed(() => this.adults() + this.children() + this.infants());
  paxLabel = computed(() => `${this.adults()} Người lớn, ${this.children()} Trẻ em, ${this.infants()} Em bé`);
  inc(k: 'adults' | 'children' | 'infants') {
    if (this.paxTotal() >= 9) return;
    if (k === 'infants' && this.infants() + 1 > this.adults()) return;
    const m = { adults: this.adults, children: this.children, infants: this.infants } as const;
    m[k].set(m[k]() + 1);
  }
  dec(k: 'adults' | 'children' | 'infants') {
    const m = { adults: this.adults, children: this.children, infants: this.infants } as const;
    const v = m[k]();
    if (k === 'adults') { if (v <= 1) return; if (this.infants() > v - 1) this.infants.set(v - 1); }
    if (v <= 0) return; m[k].set(v - 1);
  }

  airports = [
    { code: 'SGN', name: 'TP Hồ Chí Minh, Việt Nam' },
    { code: 'HAN', name: 'Hà Nội, Việt Nam' },
    { code: 'DAD', name: 'Đà Nẵng, Việt Nam' },
    { code: 'CXR', name: 'Nha Trang, Việt Nam' },
    { code: 'PQC', name: 'Phú Quốc, Việt Nam' },
  ];

  airlines = ['Vietnam Airlines', 'Vietjet', 'Bamboo Airways', 'Pacific Airlines', 'Vietravel Airlines'];
  airlineSel = signal<string[]>([]);
  priceSel = signal<string[]>([]);
  timeSel = signal<string[]>([]);
  durSel = signal<string[]>([]);
  private toggle(sigArr: ReturnType<typeof signal<string[]>>, k: string) {
    const s = new Set(sigArr()); s.has(k) ? s.delete(k) : s.add(k); sigArr.set([...s]);
  }

  toggleAirline(a: string) { this.toggle(this.airlineSel, a); }
  togglePrice(k: string) { this.toggle(this.priceSel, k); }
  toggleTime(k: string) { this.toggle(this.timeSel, k); }
  toggleDur(k: string) { this.toggle(this.durSel, k); }
  clearFilters() {
    this.airlineSel.set([]); this.priceSel.set([]); this.timeSel.set([]); this.durSel.set([]);
    this.autoDateMsg.set(null);
  }

  fetchData(autoSearchAfterLoad = false) {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.http.get('assets/data/flight-search-sampledata.json').subscribe({
      next: raw => {
        this.allFlights.set(normalizeFlights(raw));
        this.isLoading.set(false);
        if (autoSearchAfterLoad && this.from() && this.to() && this.departDate()) {
          this.search(false);
        }
      },
      error: err => {
        console.error(err);
        this.loadError.set('Lỗi tải dữ liệu.');
        this.isLoading.set(false);
      }
    });
  }

  setTrip(t: 'oneway' | 'round') {
    this.tripType.set(t);
    this.hasSearched.set(false);
    this.autoDateMsg.set(null);
    this.listLimitOut.set(3);
    this.listLimitBack.set(3);

    if (t === 'round') {
      if (this.from() && this.to()) { this.rtFrom.set(this.to()); this.rtTo.set(this.from()); }
    } else {
      this.returnDate.set(''); this.rtFrom.set(''); this.rtTo.set('');
    }
  }
  swap() { const f = this.from(); this.from.set(this.to()); this.to.set(f); }
  swapReturn() { const f = this.rtFrom(); this.rtFrom.set(this.rtTo()); this.rtTo.set(f); }

  sortOrder = signal<'price_desc' | 'price_asc'>('price_asc');
  setSort(order: 'price_desc' | 'price_asc') { this.sortOrder.set(order); }

  listLimitOut = signal(3);
  listLimitBack = signal(3);
  showMoreOut() { const total = this.resultsOut().length; this.listLimitOut.set(Math.min(this.listLimitOut() + 3, total)); }
  showMoreBack() { const total = this.resultsBack().length; this.listLimitBack.set(Math.min(this.listLimitBack() + 3, total)); }

  search(updateUrl = true) {
    this.autoDateMsg.set(null);
    if (this.tripType() === 'round' && this.returnDate() < this.departDate()) {
      alert('Ngày khứ hồi phải ≥ Ngày khởi hành.'); return;
    }

    const f = this.from().toUpperCase(), t = this.to().toUpperCase(), d = this.departDate();
    const hasExactOut = this.allFlights().some(x => x.from === f && x.to === t && x.date === d);
    if (!hasExactOut) {
      const nearest = this.nearestDateForRoute(f, t, d);
      if (nearest) { this.departDate.set(nearest); this.autoDateMsg.set(`Không có chuyến ngày ${d}. Đã tự chọn ngày gần nhất: ${nearest}.`); }
    }

    if (this.tripType() === 'round') {
      if (!this.rtFrom()) this.rtFrom.set(this.to());
      if (!this.rtTo()) this.rtTo.set(this.from());
      const rf = (this.rtFrom() || this.to()).toUpperCase();
      const rt = (this.rtTo() || this.from()).toUpperCase();
      const rd = this.returnDate();
      if (rd) {
        const hasExactBack = this.allFlights().some(x => x.from === rf && x.to === rt && x.date === rd);
        if (!hasExactBack) {
          const nearestBack = this.nearestDateForRoute(rf, rt, rd);
          if (nearestBack) {
            this.returnDate.set(nearestBack);
            const prev = this.autoDateMsg() ? this.autoDateMsg() + ' ' : '';
            this.autoDateMsg.set(prev + `Chặng về: không có chuyến ngày ${rd}. Đã tự chọn ngày gần nhất: ${nearestBack}.`);
          }
        }
      }
    }

    this.hasSearched.set(true);
    this.listLimitOut.set(3);
    this.listLimitBack.set(3);

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          trip: this.tripType(),
          from: this.from(),
          to: this.to(),
          date: this.departDate()
        },
        queryParamsHandling: 'merge'
      });
    }
  }

  private applyFiltersAndSort(arr: Flight[]) {
    const inPrice = (v: number) => {
      const s = new Set(this.priceSel()); if (!s.size) return true; const m = v / 1_000_000;
      return (s.has('p_u1500') && m < 1.5) || (s.has('p_1500_2500') && m >= 1.5 && m < 2.5) ||
        (s.has('p_2500_4000') && m >= 2.5 && m < 4.0) || (s.has('p_o4000') && m >= 4.0);
    };
    const inTime = (iso: string) => {
      const s = new Set(this.timeSel()); if (!s.size) return true; const h = new Date(iso).getHours();
      return (s.has('t_morning') && h >= 5 && h < 11) || (s.has('t_noon') && h >= 11 && h < 17) ||
        (s.has('t_evening') && h >= 17 && h <= 23);
    };
    const inDur = (mins: number) => {
      const s = new Set(this.durSel()); if (!s.size) return true;
      return (s.has('d_u60') && mins < 60) || (s.has('d_60_120') && mins >= 60 && mins <= 120) ||
        (s.has('d_o120') && mins > 120);
    };
    const inAirline = (name: string) => { const s = new Set(this.airlineSel()); return !s.size || s.has(name); };

    let out = arr.filter(x => inPrice(x.price) && inTime(x.departTime) && inDur(x.durationMin) && inAirline(x.airline));
    const order = this.sortOrder();
    out = [...out].sort((a, b) => order === 'price_desc' ? b.price - a.price : a.price - b.price);
    return out;
  }

  resultsOut = computed(() => {
    if (!this.hasSearched()) return [];
    const f = this.from().toUpperCase(), t = this.to().toUpperCase(), d = this.departDate();
    const base = this.allFlights().filter(x => x.from === f && x.to === t && x.date === d);
    return this.applyFiltersAndSort(base);
  });
  othersOut = computed(() => this.resultsOut().slice(0, this.listLimitOut()));

  resultsBack = computed(() => {
    if (!this.hasSearched() || this.tripType() !== 'round' || !this.returnDate()) return [];
    const f = (this.rtFrom() || this.to()).toUpperCase();
    const t = (this.rtTo() || this.from()).toUpperCase();
    const d = this.returnDate();
    const base = this.allFlights().filter(x => x.from === f && x.to === t && x.date === d);
    return this.applyFiltersAndSort(base);
  });
  othersBack = computed(() => this.resultsBack().slice(0, this.listLimitBack()));

  cabinLabel(c: Flight['cabin']) {
    switch (c) {
      case 'Economy': return 'Phổ thông';
      case 'Business': return 'Thương gia';
      default: return c as string;
    }
  }
  cabinLabelOrPlaceholder(v: Flight['cabin'] | '') { return v ? this.cabinLabel(v as Flight['cabin']) : 'Chọn hạng (tuỳ chọn)'; }
  getInitials(name: string) { return (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || '??'; }
  getCarrierCode(f: Flight) { return (f as any)?.details?.airline_code?.toUpperCase?.() ?? this.getInitials(f.airline); }

  priceStr(v: number, cur = 'VND', style: 'symbol' | 'code' = 'code') {
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

  timeHM(iso: string) { try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return ''; } }
  dateVN(dateOrIso: string | Date, long = false) {
    const d = (dateOrIso instanceof Date) ? dateOrIso : new Date(dateOrIso);
    const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear();
    return long ? `${wd}, ${dd} tháng ${mm} năm ${yyyy}` : `${wd}, ${dd}/${mm}/${yyyy}`;
  }
  durationStr(mins: number) { const h = Math.floor(mins / 60), m = mins % 60; if (h && m) return `${h}h${String(m).padStart(2, '0')}m`; if (h) return `${h}h`; return `${m}m`; }

  private distinctDatesForRoute(from: string, to: string) {
    const f = (from || '').toUpperCase(), t = (to || '').toUpperCase();
    const set = new Set<string>();
    this.allFlights().forEach(x => { if (x.from === f && x.to === t) set.add(x.date); });
    return Array.from(set).sort();
  }
  private nearestDateForRoute(from: string, to: string, want: string): string | null {
    const dates = this.distinctDatesForRoute(from, to);
    if (!dates.length) return null;
    if (!want) return dates[0];
    const wd = new Date(want).getTime();
    let best: string | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const d of dates) {
      const t = new Date(d).getTime();
      const diff = Math.abs(t - wd);
      if (diff < bestDiff) { bestDiff = diff; best = d; }
    }
    return best;
  }

  snapshotSearch() {
    return {
      tripType: this.tripType(),
      from: this.from(), to: this.to(),
      departDate: this.departDate(),
      returnDate: this.returnDate(),
      rtFrom: this.rtFrom(), rtTo: this.rtTo(),
      airlineSel: this.airlineSel(), priceSel: this.priceSel(),
      timeSel: this.timeSel(), durSel: this.durSel(),
      sortOrder: this.sortOrder(),
      listLimitOut: this.listLimitOut(),
      listLimitBack: this.listLimitBack(),
      hasSearched: true,
      autoDateMsg: null
    };
  }

  applySearchState(st: any) {
    try {
      this.tripType.set(st.tripType ?? 'oneway');
      this.from.set(st.from ?? ''); this.to.set(st.to ?? '');
      this.departDate.set(st.departDate ?? '');
      this.returnDate.set(st.returnDate ?? '');
      this.rtFrom.set(st.rtFrom ?? ''); this.rtTo.set(st.rtTo ?? '');

      this.airlineSel.set(st.airlineSel ?? []);
      this.priceSel.set(st.priceSel ?? []);
      this.timeSel.set(st.timeSel ?? []);
      this.durSel.set(st.durSel ?? []);

      this.sortOrder.set(st.sortOrder ?? 'price_asc');
      this.listLimitOut.set(st.listLimitOut ?? 3);
      this.listLimitBack.set(st.listLimitBack ?? 3);

      this.hasSearched.set(!!st.hasSearched);
      this.autoDateMsg.set(null);
    } catch { }
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
