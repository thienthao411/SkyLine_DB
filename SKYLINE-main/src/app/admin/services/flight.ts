import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';

export interface Flight {
  id: string;
  flightCode: string;
  airline: string;
  airlineCode?: string;
  departure: string;
  destination: string;
  takeoffTime: {
    hour: string;
    minute: string;
    day: string;
    month: string;
    year: string;
  };
  landingTime: {
    hour: string;
    minute: string;
    day: string;
    month: string;
    year: string;
  };
  durationMin?: number;
  currency?: string;
  priceEconomy?: number;
  priceBusiness?: number;
  seatsMax?: number;
  seatsBookedTotal?: number;
  stops?: number;
  stopsLabel?: string;
}

export interface AirlineCatalogItem {
  code: string;
  name: string;
}

interface ApiFlight {
  _id?: string;
  id?: string;
  flightId?: string;
  airlineId?: string;
  airline: string;
  airlineCode?: string;
  flightNo: string;
  from: string;
  to: string;
  fromAirportName?: string;
  toAirportName?: string;
  date?: string;
  departTime: string;
  arriveTime: string;
  seatsMax?: number;
  seatsBooked?: number;
  seatsBookedTotal?: number;
  durationMin?: number;
  currency?: string;
  priceEconomy?: number;
  priceBusiness?: number;
  stops?: number;
  stopsLabel?: string;
}

interface ApiAirline {
  _id?: string;
  id?: string;
  airlineCode?: string;
  airlineName?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FlightService {

  private flightApiUrl = 'http://localhost:5000/api/flights';
  private airlineApiUrl = 'http://localhost:5000/api/airlines';
  private airlineIdToNameLookup = new Map<string, string>();
  private airlineCodeToNameLookup = new Map<string, string>();
  private airlineNameToIdLookup = new Map<string, string>();
  private airlineNameToCodeLookup = new Map<string, string>();
  private knownAirlineCodeNameLookup = new Map<string, string>([
    ['VN', 'Vietnam Airlines'],
    ['VJ', 'Vietjet Air'],
    ['QH', 'Bamboo Airways'],
    ['BL', 'Pacific Airlines'],
    ['VU', 'Vietravel Airlines']
  ]);
  private airportCodeToVietnameseLookup = new Map<string, string>([
    ['HAN', 'Nội Bài (HAN)'],
    ['SGN', 'Tân Sơn Nhất (SGN)'],
    ['DAD', 'Đà Nẵng (DAD)'],
    ['CXR', 'Cam Ranh (CXR)'],
    ['PQC', 'Phú Quốc (PQC)'],
    ['HUI', 'Phú Bài (HUI)'],
    ['HPH', 'Cát Bi (HPH)'],
    ['VCA', 'Cần Thơ (VCA)'],
    ['THD', 'Thọ Xuân (THD)']
  ]);

  constructor(private http: HttpClient) { }

  getFlights(): Observable<Flight[]> {
    return forkJoin({
      flights: this.http.get<ApiFlight[]>(this.flightApiUrl),
      airlines: this.http.get<ApiAirline[]>(this.airlineApiUrl)
    }).pipe(
      map(({ flights, airlines }) => {
        this.buildAirlineLookups(airlines);
        return flights.map((apiFlight) => this.transformApiFlightToFlight(apiFlight));
      })
    );
  }

  getAirlineCatalog(): Observable<AirlineCatalogItem[]> {
    return this.http.get<ApiAirline[]>(this.airlineApiUrl).pipe(
      map((airlines) =>
        airlines
          .filter((airline) => this.isAirlineActive(airline.status))
          .map((airline) => ({
            code: (airline.airlineCode || '').trim().toUpperCase(),
            name: (airline.airlineName || '').trim()
          }))
          .filter((item) => !!item.code && !!item.name)
          .sort((a, b) => a.code.localeCompare(b.code))
      )
    );
  }

  private isAirlineActive(status?: string): boolean {
    const normalized = (status || '').trim().toLowerCase();

    return (
      normalized === 'active' ||
      normalized === 'hoat dong' ||
      normalized === 'hoatdong' ||
      normalized === 'dang hoat dong' ||
      normalized === 'operating' ||
      normalized === 'enabled'
    );
  }

  createFlight(payload: Flight): Observable<Flight> {
    return this.http.post<ApiFlight>(this.flightApiUrl, this.transformFlightToApiPayload(payload)).pipe(
      map((created) => this.transformApiFlightToFlight(created))
    );
  }

  updateFlight(id: string, payload: Flight): Observable<Flight> {
    return this.http.put<ApiFlight>(`${this.flightApiUrl}/${id}`, this.transformFlightToApiPayload(payload)).pipe(
      map((updated) => this.transformApiFlightToFlight(updated))
    );
  }

  private transformApiFlightToFlight(apiFlight: ApiFlight): Flight {

    const parseDateTime = (dateValue?: string, timeValue?: string) => {
      const d = this.buildDateTime(dateValue, timeValue);
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

      if (isNaN(d.getTime())) {
        return {
          hour: '00',
          minute: '00',
          day: '01',
          month: '01',
          year: '2025'
        };
      }

      return {
        hour: pad(d.getHours()),
        minute: pad(d.getMinutes()),
        day: pad(d.getDate()),
        month: pad(d.getMonth() + 1),
        year: d.getFullYear().toString()
      };
    };

    const resolvedAirlineCode = this.resolveAirlineCode(apiFlight);

    return {
      id: apiFlight._id || apiFlight.id || '',
      flightCode: apiFlight.flightNo || apiFlight.flightId || '',
      airline: this.toVietnameseAirlineName(this.resolveAirlineName(apiFlight)),
      airlineCode: resolvedAirlineCode,
      departure: this.toVietnameseAirportName(apiFlight.fromAirportName || apiFlight.from || ''),
      destination: this.toVietnameseAirportName(apiFlight.toAirportName || apiFlight.to || ''),
      takeoffTime: parseDateTime(apiFlight.date, apiFlight.departTime),
      landingTime: parseDateTime(apiFlight.date, apiFlight.arriveTime),
      durationMin: apiFlight.durationMin,
      currency: apiFlight.currency,
      priceEconomy: apiFlight.priceEconomy,
      priceBusiness: apiFlight.priceBusiness,
      seatsMax: apiFlight.seatsMax,
      seatsBookedTotal: apiFlight.seatsBookedTotal ?? apiFlight.seatsBooked,
      stops: apiFlight.stops,
      stopsLabel: apiFlight.stopsLabel
    };
  }

  private transformFlightToApiPayload(flight: Flight): Partial<ApiFlight> {
    const date = `${flight.takeoffTime.year}-${flight.takeoffTime.month}-${flight.takeoffTime.day}`;
    const departTime = `${date}T${flight.takeoffTime.hour}:${flight.takeoffTime.minute}:00`;
    const arriveTime = `${flight.landingTime.year}-${flight.landingTime.month}-${flight.landingTime.day}T${flight.landingTime.hour}:${flight.landingTime.minute}:00`;
    const normalizedInput = this.normalizeKey(flight.airline);
    const airlineId = this.airlineNameToIdLookup.get(normalizedInput);
    const airlineCode = this.airlineNameToCodeLookup.get(normalizedInput) || flight.airlineCode;
    const fromCode = this.extractAirportCode(flight.departure) || flight.departure;
    const toCode = this.extractAirportCode(flight.destination) || flight.destination;

    return {
      flightId: flight.flightCode,
      flightNo: flight.flightCode,
      airlineId,
      airlineCode,
      airline: flight.airline,
      from: fromCode,
      to: toCode,
      fromAirportName: flight.departure,
      toAirportName: flight.destination,
      date,
      departTime,
      arriveTime,
      durationMin: flight.durationMin,
      currency: flight.currency,
      priceEconomy: flight.priceEconomy,
      priceBusiness: flight.priceBusiness,
      seatsMax: flight.seatsMax,
      seatsBookedTotal: flight.seatsBookedTotal,
      stops: flight.stops,
      stopsLabel: flight.stopsLabel
    };
  }

  private buildDateTime(dateValue?: string, timeValue?: string): Date {
    if (timeValue) {
      const parsedTime = new Date(timeValue);
      if (!isNaN(parsedTime.getTime())) {
        return parsedTime;
      }
    }

    if (dateValue && timeValue) {
      const parsed = new Date(`${dateValue}T${timeValue}`);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (dateValue) {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return new Date('');
  }

  private buildAirlineLookups(airlines: ApiAirline[]): void {
    this.airlineIdToNameLookup = new Map<string, string>();
    this.airlineCodeToNameLookup = new Map<string, string>();
    this.airlineNameToIdLookup = new Map<string, string>();
    this.airlineNameToCodeLookup = new Map<string, string>();

    airlines.forEach((airline) => {
      const id = airline._id || airline.id;
      const name = airline.airlineName || '';
      const code = (airline.airlineCode || '').trim().toUpperCase();
      const normalizedName = this.normalizeKey(name);

      if (id) {
        this.airlineIdToNameLookup.set(id, name || code);
      }

      if (code) {
        this.airlineCodeToNameLookup.set(code, name || code);
      }

      if (id && name) {
        this.airlineNameToIdLookup.set(normalizedName, id);
      }

      if (name && code) {
        this.airlineNameToCodeLookup.set(normalizedName, code);
      }
    });
  }

  private resolveAirlineName(apiFlight: ApiFlight): string {
    const airlineId = apiFlight.airlineId;
    if (airlineId && this.airlineIdToNameLookup.has(airlineId)) {
      return this.airlineIdToNameLookup.get(airlineId) || '';
    }

    const airlineCode = this.resolveAirlineCode(apiFlight);
    if (airlineCode && this.airlineCodeToNameLookup.has(airlineCode)) {
      return this.airlineCodeToNameLookup.get(airlineCode) || '';
    }

    if (airlineCode && this.knownAirlineCodeNameLookup.has(airlineCode)) {
      return this.knownAirlineCodeNameLookup.get(airlineCode) || '';
    }

    const rawAirline = (apiFlight.airline || '').trim();
    if (rawAirline) {
      const normalizedRawAirline = this.normalizeKey(rawAirline);
      if (this.airlineNameToIdLookup.has(normalizedRawAirline) || this.airlineNameToCodeLookup.has(normalizedRawAirline)) {
        return rawAirline;
      }

      if (normalizedRawAirline.includes('bamboo')) {
        return 'Bamboo Airways';
      }
    }

    return rawAirline || airlineCode || '';
  }

  private resolveAirlineCode(apiFlight: ApiFlight): string {
    const explicitCode = (apiFlight.airlineCode || '').trim().toUpperCase();
    if (explicitCode) {
      return explicitCode;
    }

    const flightNo = (apiFlight.flightNo || apiFlight.flightId || '').trim().toUpperCase();
    const codeFromFlightNo = flightNo.match(/^[A-Z0-9]{2}/)?.[0] || '';
    return codeFromFlightNo;
  }

  private normalizeKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private toVietnameseAirlineName(value: string): string {
    const input = value.trim();
    if (!input) {
      return '';
    }

    if (this.containsVietnameseDiacritics(input)) {
      return input;
    }

    const normalized = this.normalizeKey(input);
    const knownAirlineNames: Record<string, string> = {
      'vietjet air': 'Vietjet Air',
      'vietnam airlines': 'Vietnam Airlines',
      'bamboo airways': 'Bamboo Airways',
      'vietravel airlines': 'Vietravel Airlines',
      'pacific airlines': 'Pacific Airlines'
    };

    return knownAirlineNames[normalized] || input;
  }

  private toVietnameseAirportName(value: string): string {
    const input = value.trim();
    if (!input) {
      return '';
    }

    if (this.containsVietnameseDiacritics(input)) {
      return input;
    }

    const extractedCode = this.extractAirportCode(input);
    if (extractedCode && this.airportCodeToVietnameseLookup.has(extractedCode)) {
      return this.airportCodeToVietnameseLookup.get(extractedCode) || input;
    }

    const normalized = this.normalizeKey(input);
    const knownAirportNames: Record<string, string> = {
      'noi bai': 'Nội Bài',
      'tan son nhat': 'Tân Sơn Nhất',
      'da nang': 'Đà Nẵng',
      'phu quoc': 'Phú Quốc',
      'can tho': 'Cần Thơ',
      'cam ranh': 'Cam Ranh',
      'cat bi': 'Cát Bi',
      'tho xuan': 'Thọ Xuân',
      'phu bai': 'Phú Bài',
      'ho chi minh': 'TP. Hồ Chí Minh',
      'hanoi': 'Hà Nội'
    };

    return knownAirportNames[normalized] || input;
  }

  private extractAirportCode(value: string): string | null {
    const trimmed = value.trim().toUpperCase();

    if (/^[A-Z]{3}$/.test(trimmed)) {
      return trimmed;
    }

    const match = trimmed.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : null;
  }

  private containsVietnameseDiacritics(value: string): boolean {
    return /[\u00C0-\u1EF9]/.test(value);
  }
}