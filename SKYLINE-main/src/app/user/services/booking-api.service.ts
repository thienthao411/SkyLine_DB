import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type Cabin = 'Economy' | 'Premium Economy' | 'Business';

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
  details?: Record<string, unknown>;
  fromAirport?: string;
  toAirport?: string;
}

export interface BaggageOption {
  _id?: string;
  code: string;
  name: string;
  price: number;
  priceDisplay: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface BookingPayload {
  flightId: string;
  flight: Flight;
  passengerInfo: Record<string, unknown>;
  seat: string;
  seatType: string;
  baggageOption: BaggageOption | null;
  payment: Record<string, unknown>;
  totalAmount: number;
  bookingDate: string;
}

export interface BookingRecord {
  ticketCode: string;
  flightId: string;
  flight: Flight;
  passengerInfo: Record<string, any>;
  seat: string;
  seatType: string;
  baggageOption: BaggageOption | null;
  totalAmount: number;
  payment: Record<string, unknown>;
  bookingDate: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingApiService {
  private readonly baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  getFlightById(flightId: string): Observable<Flight> {
    return this.http
      .get<{ success: boolean; flight: Flight }>(`${this.baseUrl}/flights/${encodeURIComponent(flightId)}`)
      .pipe(map((response) => response.flight));
  }

  getOccupiedSeats(flightId: string): Observable<string[]> {
    return this.http
      .get<{ success: boolean; occupiedSeats: string[] }>(`${this.baseUrl}/flights/${encodeURIComponent(flightId)}/seats`)
      .pipe(map((response) => response.occupiedSeats ?? []));
  }

  getBaggageOptions(): Observable<BaggageOption[]> {
    return this.http
      .get<{ success: boolean; options: BaggageOption[] }>(`${this.baseUrl}/baggage-options`)
      .pipe(map((response) => response.options ?? []));
  }

  createBooking(payload: BookingPayload): Observable<BookingRecord> {
    return this.http
      .post<{ success: boolean; booking: BookingRecord }>(`${this.baseUrl}/bookings`, payload)
      .pipe(map((response) => response.booking));
  }

  getBooking(ticketCode: string): Observable<BookingRecord> {
    return this.http
      .get<{ success: boolean; booking: BookingRecord }>(`${this.baseUrl}/bookings/${encodeURIComponent(ticketCode)}`)
      .pipe(map((response) => response.booking));
  }
}