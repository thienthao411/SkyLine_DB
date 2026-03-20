import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { AirportApiService, Airport } from '../services/airport-api.service';

export interface Flight {
  id: string;
  airlineId?: string;
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

interface ApiAirlineLogo {
  _id?: string;
  id?: string;
  airlineCode?: string;
  airlineName?: string;
  img?: string;
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
  private airportApi = inject(AirportApiService);
  private readonly apiBaseUrl = 'http://localhost:5000/api';
  private airlineLogoById = signal<Record<string, string>>({});
  private airlineNameById = signal<Record<string, string>>({});
  private airlineIdByCode = signal<Record<string, string>>({});
  private airlineIdByName = signal<Record<string, string>>({});
  private legacyFlights = signal<Flight[]>([]);

  private fromSearch$ = new Subject<string>();
  private toSearch$ = new Subject<string>();

  fromInput = signal('');
  toInput = signal('');
  fromAirportSuggestions = signal<Airport[]>([]);
  toAirportSuggestions = signal<Airport[]>([]);
  selectedFromAirport = signal<Airport | null>(null);
  selectedToAirport = signal<Airport | null>(null);
  allAirports = signal<Airport[]>([]);
  airports = computed(() => {
    const byCode = new Map<string, Airport>();

    [
      ...this.allAirports(),
      this.selectedFromAirport(),
      this.selectedToAirport(),
      ...this.fromAirportSuggestions(),
      ...this.toAirportSuggestions()
    ].forEach((airport) => {
      if (!airport?.code) return;
      byCode.set(String(airport.code).toUpperCase(), airport);
    });

    return Array.from(byCode.values()).sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''))
    );
  });

  constructor(private http: HttpClient) {
    const st = (history.state as any)?.search;
    if (st) this.applySearchState(st);

    const p = this.route.snapshot.queryParamMap;
    const qpTrip = (p.get('trip') as 'oneway' | 'round' | null) ?? null;
    const qpFrom = (p.get('from') ?? '').toUpperCase();
    const qpTo = (p.get('to') ?? '').toUpperCase();
    const qpDate = p.get('date') ?? '';

    if (qpTrip) this.tripType.set(qpTrip);
    if (qpFrom) {
      this.from.set(qpFrom);
      this.fromInput.set(qpFrom);
      this.selectedFromAirport.set(this.airportApi.getAirportByCode(qpFrom) ?? null);
    }
    if (qpTo) {
      this.to.set(qpTo);
      this.toInput.set(qpTo);
      this.selectedToAirport.set(this.airportApi.getAirportByCode(qpTo) ?? null);
    }
    if (qpDate) this.departDate.set(qpDate);

    this.fromSearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        const text = String(q || '').trim();
        if (!text) return of([]);
        return this.airportApi.searchAirports(text).pipe(catchError(() => of([])));
      })
    ).subscribe((items) => {
      this.fromAirportSuggestions.set(items || []);
    });

    this.toSearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        const text = String(q || '').trim();
        if (!text) return of([]);
        return this.airportApi.searchAirports(text).pipe(catchError(() => of([])));
      })
    ).subscribe((items) => {
      this.toAirportSuggestions.set(items || []);
    });

    this.loadAirlineLogos();
    this.loadAllAirports();
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

  private airportDisplay(airport: Airport | null, code: string, fallback = ''): string {
    if (airport?.code && airport?.name) {
      return `${airport.code} - ${airport.name}`;
    }

    if (fallback && fallback.includes(' - ')) {
      return fallback;
    }

    return String(code || fallback || '').trim().toUpperCase();
  }

  returnFromDisplay() {
    const airport = this.airportApi.getAirportByCode(this.rtFrom() || this.to()) ?? this.selectedToAirport();
    return this.airportDisplay(airport, this.rtFrom() || this.to(), this.toInput());
  }

  returnToDisplay() {
    const airport = this.airportApi.getAirportByCode(this.rtTo() || this.from()) ?? this.selectedFromAirport();
    return this.airportDisplay(airport, this.rtTo() || this.from(), this.fromInput());
  }

  private loadAllAirports() {
    this.airportApi.getAllAirports().pipe(catchError(() => of([]))).subscribe((items) => {
      const airports = items || [];
      this.allAirports.set(airports);

      if (this.from() && !this.selectedFromAirport()) {
        this.selectedFromAirport.set(this.airportApi.getAirportByCode(this.from()) ?? null);
      }

      if (this.to() && !this.selectedToAirport()) {
        this.selectedToAirport.set(this.airportApi.getAirportByCode(this.to()) ?? null);
      }
    });
  }

  onFromSearchInput(text: string) {
    this.fromInput.set(text);
    this.selectedFromAirport.set(null);
    this.from.set('');
    if (text.trim().length === 0) {
      this.showAllFromAirports();
      return;
    }
    this.fromSearch$.next(text.trim());
  }

  onToSearchInput(text: string) {
    this.toInput.set(text);
    this.selectedToAirport.set(null);
    this.to.set('');
    if (text.trim().length === 0) {
      this.showAllToAirports();
      return;
    }
    this.toSearch$.next(text.trim());
  }

  showAllFromAirports() {
    this.airportApi.getAllAirports().pipe(catchError(() => of([]))).subscribe((items) => {
      this.fromAirportSuggestions.set(items || []);
    });
  }

  showAllToAirports() {
    this.airportApi.getAllAirports().pipe(catchError(() => of([]))).subscribe((items) => {
      this.toAirportSuggestions.set(items || []);
    });
  }

  toggleFromAirportDropdown() {
    if (this.fromAirportSuggestions().length > 0) {
      this.fromAirportSuggestions.set([]);
      return;
    }

    if (this.fromInput().trim()) {
      this.fromSearch$.next(this.fromInput().trim());
      return;
    }

    this.showAllFromAirports();
  }

  toggleToAirportDropdown() {
    if (this.toAirportSuggestions().length > 0) {
      this.toAirportSuggestions.set([]);
      return;
    }

    if (this.toInput().trim()) {
      this.toSearch$.next(this.toInput().trim());
      return;
    }

    this.showAllToAirports();
  }

  selectFromAirport(airport: Airport) {
    this.selectedFromAirport.set(airport);
    this.from.set((airport.code || '').toUpperCase());
    this.fromInput.set(`${airport.code} - ${airport.name}`);
    this.fromAirportSuggestions.set([]);

    if (this.to().toUpperCase() === airport.code.toUpperCase()) {
      this.to.set('');
      this.selectedToAirport.set(null);
      this.toInput.set('');
    }
  }

  selectToAirport(airport: Airport) {
    this.selectedToAirport.set(airport);
    this.to.set((airport.code || '').toUpperCase());
    this.toInput.set(`${airport.code} - ${airport.name}`);
    this.toAirportSuggestions.set([]);

    if (this.from().toUpperCase() === airport.code.toUpperCase()) {
      this.from.set('');
      this.selectedFromAirport.set(null);
      this.fromInput.set('');
    }
  }

  isFromToValid() {
    return this.from().trim() && this.to().trim() && this.from().trim().toUpperCase() !== this.to().trim().toUpperCase();
  }

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

  airlines = ['Vietnam Airlines', 'Vietjet', 'Bamboo Airways', 'VASCO Airlines', 'Vietravel Airlines'];
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
    this.http.get('assets/data/flight-search-sampledata.json').subscribe({
      next: raw => {
        this.legacyFlights.set(normalizeFlights(raw));
        if (autoSearchAfterLoad && this.from() && this.to() && this.departDate()) {
          this.search(false);
        }
      },
      error: err => {
        console.warn('Khong tai duoc legacy flight data:', err);
        this.legacyFlights.set([]);
        if (autoSearchAfterLoad && this.from() && this.to() && this.departDate()) {
          this.search(false);
        }
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
      if (this.from() && this.to()) {
        this.rtFrom.set(this.to());
        this.rtTo.set(this.from());
      }
    } else {
      this.returnDate.set(''); this.rtFrom.set(''); this.rtTo.set('');
    }
  }
  swap() {
    const fromCode = this.from();
    const toCode = this.to();
    const fromInput = this.fromInput();
    const toInput = this.toInput();
    const fromAirport = this.selectedFromAirport();
    const toAirport = this.selectedToAirport();

    this.from.set(toCode);
    this.to.set(fromCode);
    this.fromInput.set(toInput);
    this.toInput.set(fromInput);
    this.selectedFromAirport.set(toAirport);
    this.selectedToAirport.set(fromAirport);
    this.fromAirportSuggestions.set([]);
    this.toAirportSuggestions.set([]);
  }
  swapReturn() { const f = this.rtFrom(); this.rtFrom.set(this.rtTo()); this.rtTo.set(f); }

  resetSearchForm() {
    this.from.set('');
    this.to.set('');
    this.fromInput.set('');
    this.toInput.set('');
    this.selectedFromAirport.set(null);
    this.selectedToAirport.set(null);
    this.fromAirportSuggestions.set([]);
    this.toAirportSuggestions.set([]);
    this.departDate.set('');
    this.returnDate.set('');
    this.rtFrom.set('');
    this.rtTo.set('');
    this.cabinOut.set('');
    this.cabinBack.set('');
    this.hasSearched.set(false);
    this.autoDateMsg.set(null);
    this.clearFilters();
  }

  sortOrder = signal<'price_desc' | 'price_asc'>('price_asc');
  setSort(order: 'price_desc' | 'price_asc') { this.sortOrder.set(order); }

  listLimitOut = signal(3);
  listLimitBack = signal(3);
  showMoreOut() { const total = this.resultsOut().length; this.listLimitOut.set(Math.min(this.listLimitOut() + 3, total)); }
  showMoreBack() { const total = this.resultsBack().length; this.listLimitBack.set(Math.min(this.listLimitBack() + 3, total)); }

  search(updateUrl = true) {
    this.autoDateMsg.set(null);
    if (!this.isFromToValid()) {
      alert('Vui lòng chọn điểm đi và điểm đến khác nhau và hợp lệ.');
      return;
    }

    if (this.tripType() === 'round' && this.returnDate() < this.departDate()) {
      alert('Ngày khứ hồi phải ≥ Ngày khởi hành.'); return;
    }

    if (this.tripType() === 'round') {
      if (!this.rtFrom()) this.rtFrom.set(this.to());
      if (!this.rtTo()) this.rtTo.set(this.from());
    }

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

    this.isLoading.set(true);
    this.loadError.set(null);

    const outbound$ = this.searchFlightsApi(this.from(), this.to(), this.departDate(), this.cabinOut());

    const returnDate = this.returnDate();
    const hasRoundTripReturn = this.tripType() === 'round' && !!returnDate;

    if (hasRoundTripReturn) {
      forkJoin({
        outbound: outbound$,
        inbound: this.searchFlightsApi(
          this.rtFrom() || this.to(),
          this.rtTo() || this.from(),
          returnDate,
          this.cabinBack()
        )
      }).subscribe({
        next: ({ outbound, inbound }) => {
          this.allFlights.set([...outbound, ...inbound]);
          this.hasSearched.set(true);
          this.listLimitOut.set(3);
          this.listLimitBack.set(3);
          this.isLoading.set(false);
        },
        error: err => {
          console.error(err);
          this.allFlights.set([]);
          this.hasSearched.set(true);
          this.listLimitOut.set(3);
          this.listLimitBack.set(3);
          this.loadError.set('Lỗi tải dữ liệu.');
          this.isLoading.set(false);
        }
      });
      return;
    }

    outbound$.subscribe({
      next: (flights) => {
        this.allFlights.set(flights);
        this.hasSearched.set(true);
        this.listLimitOut.set(3);
        this.listLimitBack.set(3);
        this.isLoading.set(false);
      },
      error: err => {
        console.error(err);
        this.allFlights.set([]);
        this.hasSearched.set(true);
        this.listLimitOut.set(3);
        this.listLimitBack.set(3);
        this.loadError.set('Lỗi tải dữ liệu.');
        this.isLoading.set(false);
      }
    });
  }

  private searchFlightsApi(
    from: string,
    to: string,
    date: string,
    requestedCabin: Flight['cabin'] | ''
  ): Observable<Flight[]> {
    return forkJoin({
      rows: this.http.get<any[]>(`${this.apiBaseUrl}/flights/search`, {
        params: {
          from: String(from || '').trim().toUpperCase(),
          to: String(to || '').trim().toUpperCase(),
          date: String(date || '').trim()
        }
      }),
      airlines: this.http.get<ApiAirlineLogo[]>(`${this.apiBaseUrl}/airlines`).pipe(
        catchError(() => of([] as ApiAirlineLogo[]))
      )
    }).pipe(
      map(({ rows, airlines }) => {
        const { logoLookup, nameLookup } = this.buildAirlineLookups(airlines);

        this.airlineLogoById.set(logoLookup);
        this.airlineNameById.set(nameLookup);

        return (Array.isArray(rows) ? rows : []).map((row) => this.mapApiFlight(row, requestedCabin));
      })
    );
  }

  private loadAirlineLogos(): void {
    this.http.get<ApiAirlineLogo[]>(`${this.apiBaseUrl}/airlines`).pipe(
      map((airlines) => this.buildAirlineLookups(airlines))
    ).subscribe({
      next: ({ logoLookup, nameLookup }) => {
        this.airlineLogoById.set(logoLookup);
        this.airlineNameById.set(nameLookup);
        this.airlineIdByCode.set(this.buildAirlineCodeToIdLookup());
        this.airlineIdByName.set(this.buildAirlineNameToIdLookup());
      },
      error: (err) => {
        console.warn('Khong tai duoc logo airline tu API:', err);
        this.airlineLogoById.set({});
        this.airlineNameById.set({});
        this.airlineIdByCode.set({});
        this.airlineIdByName.set({});
      }
    });
  }

  private buildAirlineLookups(airlines: ApiAirlineLogo[] | null | undefined) {
    const logoLookup: Record<string, string> = {};
    const nameLookup: Record<string, string> = {};
    const idByCode: Record<string, string> = {};
    const idByName: Record<string, string> = {};

    (Array.isArray(airlines) ? airlines : []).forEach((airline) => {
      const id = String(airline?._id || airline?.id || '').trim();
      const code = String(airline?.airlineCode || '').trim().toUpperCase();
      const name = String(airline?.airlineName || '').trim();
      const img = String(airline?.img || '').trim();

      if (id && name) {
        nameLookup[id] = name;
        idByName[this.normalizeAirlineKey(name)] = id;
      }

      if (id && img) {
        logoLookup[id] = img;
      }

      if (id && code) {
        idByCode[code] = id;
      }
    });

    this.airlineIdByCode.set(idByCode);
    this.airlineIdByName.set(idByName);

    return { logoLookup, nameLookup };
  }

  private mapApiFlight(raw: any, requestedCabin: Flight['cabin'] | ''): Flight {
    const legacy = this.findLegacyFlight(raw, requestedCabin);
    const cabin = legacy?.cabin ?? this.pickCabin(raw, requestedCabin);
    const airlineId = this.resolveAirlineId(raw, legacy);
    const airlineCode = String(raw?.airlineCode || legacy?.details?.airline_code || this.getInitials(raw?.airline || '')).toUpperCase();
    const from = String(raw?.from || '').trim().toUpperCase();
    const to = String(raw?.to || '').trim().toUpperCase();
    const date = String(raw?.date || '').trim();
    const flightNo = String(raw?.flightNo || legacy?.flightNo || 'XX000');
    const departTime = this.normalizeDateTime(date, raw?.departTime || legacy?.departTime || '');
    const arriveTime = this.normalizeDateTime(date, raw?.arriveTime || legacy?.arriveTime || '');
    const price = this.pickPrice(raw, cabin, legacy?.price);
    const seatsLeft = this.pickSeatsLeft(raw, cabin, legacy?.seatsLeft);
    const details = this.mapFlightDetails(raw, legacy, {
      airlineId,
      airlineCode,
      from,
      to,
      date,
      flightNo,
      departTime,
      arriveTime
    });

    return {
      id: legacy?.id ?? String(raw?._id || this.buildLegacyCompatibleId(airlineCode, flightNo, from, to, date, cabin)),
      airlineId,
      airline: this.resolveAirlineName(raw, legacy),
      flightNo,
      from,
      to,
      date,
      departTime,
      arriveTime,
      durationMin: Number(raw?.durationMin ?? legacy?.durationMin ?? 0),
      price,
      currency: (String(raw?.currency || legacy?.currency || 'VND') as 'VND' | 'USD'),
      seatsLeft,
      cabin,
      details
    };
  }

  private mapFlightDetails(
    raw: any,
    legacy: Flight | null,
    ctx: {
      airlineId: string;
      airlineCode: string;
      from: string;
      to: string;
      date: string;
      flightNo: string;
      departTime: string;
      arriveTime: string;
    }
  ) {
    const rawDetails = raw?.details ?? {};
    const legacyDetails = legacy?.details ?? {};
    const rawSegments = Array.isArray(rawDetails?.itinerary?.segments) ? rawDetails.itinerary.segments : [];

    const segments = rawSegments.length
      ? rawSegments.map((segment: any) => ({
          origin: String(segment?.origin || segment?.from || ctx.from).toUpperCase(),
          destination: String(segment?.destination || segment?.to || ctx.to).toUpperCase(),
          depart: this.normalizeDateTime(ctx.date, segment?.depart || segment?.departTime || ctx.departTime),
          arrive: this.normalizeDateTime(ctx.date, segment?.arrive || segment?.arriveTime || ctx.arriveTime),
          aircraft: segment?.aircraft || null,
          flightNo: String(segment?.flightNo || ctx.flightNo),
        }))
      : (legacyDetails?.itinerary?.segments ?? [
          {
            origin: ctx.from,
            destination: ctx.to,
            depart: ctx.departTime,
            arrive: ctx.arriveTime,
            aircraft: null,
            flightNo: ctx.flightNo,
          }
        ]);

    const fareOptions = Array.isArray(rawDetails?.fare_options)
      ? rawDetails.fare_options.map((option: any) => ({
          type: option?.type || this.buildFareType(option?.class, ctx.flightNo),
          baggage: option?.baggage ?? null,
          change_fee: option?.change_fee ?? null,
          refundable: Boolean(option?.refundable),
          price: Number(option?.price ?? 0),
        }))
      : (legacyDetails?.fare_options ?? []);

    return {
      ...legacyDetails,
      airline_id: ctx.airlineId,
      airline_code: ctx.airlineCode,
      itinerary: { segments },
      perks: Array.isArray(rawDetails?.perks) ? rawDetails.perks : (legacyDetails?.perks ?? []),
      fare_options: fareOptions,
      fromAirportName: raw?.fromAirportName || rawDetails?.fromAirportName || legacyDetails?.fromAirportName || null,
      toAirportName: raw?.toAirportName || rawDetails?.toAirportName || legacyDetails?.toAirportName || null,
      stops: raw?.stops ?? rawDetails?.stops ?? legacyDetails?.stops ?? 0,
      stopsLabel: raw?.stopsLabel || rawDetails?.stopsLabel || legacyDetails?.stopsLabel || 'Bay thẳng',
    };
  }

  private findLegacyFlight(raw: any, requestedCabin: Flight['cabin'] | ''): Flight | null {
    const flightNo = String(raw?.flightNo || '').trim();
    const from = String(raw?.from || '').trim().toUpperCase();
    const to = String(raw?.to || '').trim().toUpperCase();
    const date = String(raw?.date || '').trim();
    const airlineId = this.resolveAirlineId(raw, null);
    const airlineCode = String(raw?.airlineCode || '').trim().toUpperCase();

    const matches = this.legacyFlights().filter((flight) => {
      const legacyAirlineId = String(flight?.airlineId || flight?.details?.airline_id || '').trim();
      const legacyCode = String(flight?.details?.airline_code || '').trim().toUpperCase();
      const sameAirlineId = !airlineId || !legacyAirlineId || legacyAirlineId === airlineId;
      const sameCode = !airlineCode || !legacyCode || legacyCode === airlineCode;
      return sameAirlineId
        && sameCode
        && flight.flightNo === flightNo
        && flight.from === from
        && flight.to === to
        && flight.date === date;
    });

    if (!matches.length) return null;

    const preferredCabins = [
      requestedCabin,
      'Economy',
      'Premium Economy',
      'Business'
    ].filter(Boolean) as Flight['cabin'][];

    for (const cabin of preferredCabins) {
      const match = matches.find((flight) => flight.cabin === cabin);
      if (match) return match;
    }

    return matches[0];
  }

  private pickCabin(raw: any, requestedCabin: Flight['cabin'] | ''): Flight['cabin'] {
    if (requestedCabin) return requestedCabin;
    if (raw?.priceEconomy != null) return 'Economy';
    if (raw?.priceBusiness != null) return 'Business';
    return 'Economy';
  }

  private pickPrice(raw: any, cabin: Flight['cabin'], fallback = 0): number {
    if (cabin === 'Business') {
      return Number(raw?.priceBusiness ?? raw?.priceEconomy ?? fallback ?? 0);
    }

    return Number(raw?.priceEconomy ?? raw?.priceBusiness ?? fallback ?? 0);
  }

  private pickSeatsLeft(raw: any, cabin: Flight['cabin'], fallback = 0): number {
    if (cabin === 'Business') {
      const max = Number(raw?.seatsBusinessMax ?? 0);
      const booked = Number(raw?.seatsBookedBusiness ?? 0);
      return max > 0 ? Math.max(0, max - booked) : Number(fallback ?? 0);
    }

    const max = Number(raw?.seatsEconomyMax ?? raw?.seatsMax ?? 0);
    const booked = Number(raw?.seatsBookedEconomy ?? raw?.seatsBookedTotal ?? 0);
    return max > 0 ? Math.max(0, max - booked) : Number(fallback ?? 0);
  }

  private buildLegacyCompatibleId(
    airlineCode: string,
    flightNo: string,
    from: string,
    to: string,
    date: string,
    cabin: Flight['cabin']
  ): string {
    const cabinCode = cabin === 'Business' ? 'BU' : cabin === 'Premium Economy' ? 'PR' : 'EC';
    return `${airlineCode}-${flightNo}-${from}-${to}-${date}-${cabinCode}`;
  }

  private normalizeDateTime(date: string, value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.includes('T')) return raw;

    if (/^\d{2}:\d{2}$/.test(raw)) {
      return `${date}T${raw}:00+07:00`;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return `${date}T${raw}+07:00`;
    }

    return raw;
  }

  private buildFareType(fareClass: string, flightNo: string): string {
    const cls = String(fareClass || '').trim().toLowerCase();
    const code = String(flightNo || '').slice(0, 2).toUpperCase() || 'FL';

    if (cls === 'business') return `${code} Business`;
    if (cls === 'economy') return `${code} Economy`;
    return `${code} Fare`;
  }

  private resolveAirlineId(raw: any, legacy: Flight | null): string {
    const explicitId = String(
      raw?.airlineId
      || raw?.airlineID
      || raw?.airline_id
      || raw?.airline?._id
      || raw?.airline?.id
      || raw?.details?.airline_id
      || legacy?.airlineId
      || legacy?.details?.airline_id
      || ''
    ).trim();

    if (explicitId) {
      return explicitId;
    }

    const explicitCode = String(
      raw?.airlineCode
      || raw?.details?.airline_code
      || legacy?.details?.airline_code
      || ''
    ).trim().toUpperCase();

    if (explicitCode && this.airlineIdByCode()[explicitCode]) {
      return this.airlineIdByCode()[explicitCode];
    }

    const flightNoPrefix = String(raw?.flightNo || legacy?.flightNo || '').trim().toUpperCase().slice(0, 2);
    if (flightNoPrefix && this.airlineIdByCode()[flightNoPrefix]) {
      return this.airlineIdByCode()[flightNoPrefix];
    }

    const rawAirlineName = String(raw?.airline || legacy?.airline || '').trim();
    const normalizedName = this.normalizeAirlineKey(rawAirlineName);
    if (normalizedName && this.airlineIdByName()[normalizedName]) {
      return this.airlineIdByName()[normalizedName];
    }

    return '';
  }

  private resolveAirlineName(raw: any, legacy: Flight | null): string {
    const airlineId = this.resolveAirlineId(raw, legacy);
    const fromLookup = airlineId ? this.airlineNameById()[airlineId] : '';

    if (fromLookup) {
      return fromLookup;
    }

    return String(raw?.airline || legacy?.airline || 'Unknown').trim() || 'Unknown';
  }

  private resolveAirlineIdFromFlight(flight: any): string {
    const directId = String(flight?.airlineId || flight?.details?.airline_id || '').trim();
    if (directId) {
      return directId;
    }

    const explicitCode = String(flight?.airlineCode || flight?.details?.airline_code || '').trim().toUpperCase();
    if (explicitCode && this.airlineIdByCode()[explicitCode]) {
      return this.airlineIdByCode()[explicitCode];
    }

    const flightNoPrefix = String(flight?.flightNo || '').trim().toUpperCase().slice(0, 2);
    if (flightNoPrefix && this.airlineIdByCode()[flightNoPrefix]) {
      return this.airlineIdByCode()[flightNoPrefix];
    }

    const rawName = this.normalizeAirlineKey(String(flight?.airline || '').trim());
    if (rawName && this.airlineIdByName()[rawName]) {
      return this.airlineIdByName()[rawName];
    }

    return '';
  }

  private normalizeAirlineKey(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private buildAirlineCodeToIdLookup(): Record<string, string> {
    return { ...this.airlineIdByCode() };
  }

  private buildAirlineNameToIdLookup(): Record<string, string> {
    return { ...this.airlineIdByName() };
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
  displayAirlineName(f: Flight) {
    const airlineId = this.resolveAirlineIdFromFlight(f);
    return airlineId ? (this.airlineNameById()[airlineId] || f.airline || 'Unknown') : (f.airline || 'Unknown');
  }
  getCarrierCode(f: Flight) {
    const directCode = String((f as any)?.airlineCode || (f as any)?.details?.airline_code || '').trim().toUpperCase();
    if (directCode) return directCode;
    const fromFlightNo = String(f?.flightNo || '').trim().toUpperCase().slice(0, 2);
    if (fromFlightNo) return fromFlightNo;
    return this.getInitials(this.displayAirlineName(f));
  }

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

  logoOf(f: any): string | null {
    if ((f as any)?._logoError) return null;
    const byData = f?.details?.logo?.trim?.();
    if (byData) return byData;
    const airlineId = this.resolveAirlineIdFromFlight(f);
    return airlineId ? (this.airlineLogoById()[airlineId] ?? null) : null;
  }
}
