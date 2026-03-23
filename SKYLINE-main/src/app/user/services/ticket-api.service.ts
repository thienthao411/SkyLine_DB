import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

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
  priceEconomy?: number;
  priceBusiness?: number;
  priceBussiness?: number;
  economyPrice?: number;
  businessPrice?: number;
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

export interface AccountEmailPayload {
  accountStatus: 'existing' | 'created';
  tempPassword?: string;
  notificationCreated?: boolean;
}

interface RawTicketLike {
  _id?: string;
  ticketCode?: string;
  flightId?: string | { _id?: string; id?: string };
  flight?: { _id?: string; id?: string; flightId?: string };
  seat?: string;
  status?: string;
  passengerInfo?: {
    email?: string;
  };
}

interface ApiFlightDoc {
  _id?: string;
  id?: string;
  flightId?: string;
  priceEconomy?: number;
  priceBusiness?: number;
  priceBussiness?: number;
}

interface OccupiedSeatsResponse {
  success?: boolean;
  occupiedSeats?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TicketApiService {
  private readonly baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  getFlightById(flightId: string): Observable<Flight> {
    return this.http
      .get<{ success?: boolean; flight?: Flight } | Flight>(`${this.baseUrl}/flights/${encodeURIComponent(flightId)}`)
      .pipe(
        map((response) => this.normalizeFlightResponse(response)),
        switchMap((flight) => this.enrichFlightFaresIfMissing(flight, flightId))
      );
  }

  getOccupiedSeats(flightId: string): Observable<string[]> {
    return this.getFlightById(flightId).pipe(
      map((flight) => {
        const seats = Array.isArray((flight as any)?.details?.bookedSeats)
          ? (flight as any).details.bookedSeats
          : [];
        return this.normalizeSeatList(seats);
      }),
      switchMap((seatsFromFlight) => {
        if (seatsFromFlight.length > 0) {
          return of(seatsFromFlight);
        }

        return this.http
          .get<OccupiedSeatsResponse | string[]>(`${this.baseUrl}/flights/${encodeURIComponent(flightId)}/seats`)
          .pipe(
            map((response) => {
              const seats = Array.isArray(response)
                ? response
                : Array.isArray(response?.occupiedSeats)
                  ? response.occupiedSeats
                  : [];
              return this.normalizeSeatList(seats);
            }),
            switchMap((seatsFromEndpoint) => {
              if (seatsFromEndpoint.length > 0) {
                return of(seatsFromEndpoint);
              }

              return this.getOccupiedSeatsFromTickets(flightId);
            }),
            catchError(() => this.getOccupiedSeatsFromTickets(flightId))
          );
      }),
      catchError(() => this.getOccupiedSeatsFromTickets(flightId))
    );
  }

  getOccupiedSeatsFromTickets(flightId: string): Observable<string[]> {
    return this.http
      .get<RawTicketLike[] | { success?: boolean; tickets?: RawTicketLike[] }>(`${this.baseUrl}/tickets`)
      .pipe(
        map((response) => this.extractOccupiedSeatsFromTicketField(this.toRawTicketArray(response), flightId)),
        catchError(() => of([]))
      );
  }

  getBaggageOptions(): Observable<BaggageOption[]> {
    return this.http
      .get<{ success?: boolean; options?: BaggageOption[]; data?: BaggageOption[]; items?: BaggageOption[] } | BaggageOption[]>(`${this.baseUrl}/baggage-options`)
      .pipe(
        map((response) => this.normalizeBaggageOptionsResponse(response)),
        switchMap((options) => {
          if (options.length > 0) {
            return of(options);
          }

          return this.http
            .get<{ success?: boolean; options?: BaggageOption[]; data?: BaggageOption[]; items?: BaggageOption[] } | BaggageOption[]>(`${this.baseUrl}/baggageoptions`)
            .pipe(
              map((response) => this.normalizeBaggageOptionsResponse(response)),
              catchError(() => of([]))
            );
        }),
        catchError(() =>
          this.http
            .get<{ success?: boolean; options?: BaggageOption[]; data?: BaggageOption[]; items?: BaggageOption[] } | BaggageOption[]>(`${this.baseUrl}/baggageoptions`)
            .pipe(
              map((response) => this.normalizeBaggageOptionsResponse(response)),
              catchError(() => of([]))
            )
        )
      );
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

  getTickets(email?: string): Observable<BookingRecord[]> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const query = normalizedEmail ? `?email=${encodeURIComponent(normalizedEmail)}` : '';

    return this.http
      .get<{ success?: boolean; tickets?: BookingRecord[] } | BookingRecord[]>(`${this.baseUrl}/bookings/tickets/list${query}`)
      .pipe(
        map((response) => {
          const records = this.toBookingRecordArray(response);

          if (!normalizedEmail) {
            return records;
          }

          return records.filter((record) => {
            const recordEmail = String(record?.passengerInfo?.['email'] || '').trim().toLowerCase();
            return recordEmail === normalizedEmail;
          });
        })
      );
  }

  getTicket(ticketCode: string): Observable<BookingRecord> {
    const normalizedTicketCode = String(ticketCode || '').trim();

    return this.http
      .get<{ success: boolean; ticket: BookingRecord }>(`${this.baseUrl}/bookings/tickets/${encodeURIComponent(normalizedTicketCode)}`)
      .pipe(map((response) => response.ticket));
  }

  updateBookingStatus(ticketCode: string, status: string, paymentData?: Record<string, unknown>): Observable<BookingRecord> {
    return this.http
      .patch<{ success: boolean; booking: BookingRecord }>(
        `${this.baseUrl}/bookings/${encodeURIComponent(ticketCode)}/status`,
        { status, paymentData }
      )
      .pipe(map((response) => response.booking));
  }

  sendAccountEmail(ticketCode: string, payload: AccountEmailPayload): Observable<BookingRecord> {
    return this.http
      .post<{ success: boolean; booking: BookingRecord }>(
        `${this.baseUrl}/bookings/${encodeURIComponent(ticketCode)}/account-email`,
        payload,
      )
      .pipe(map((response) => response.booking));
  }

  private extractOccupiedSeatsFromTicketField(tickets: RawTicketLike[], flightId: string): string[] {
    const cancelledStatuses = new Set(['cancelled', 'canceled', 'huy', 'hủy']);
    const targetFlightId = this.normalizeFlightId(flightId);

    const occupiedSeats = tickets
      .filter((ticket) => {
        const status = String(ticket?.status || '').trim().toLowerCase();
        if (status && cancelledStatuses.has(status)) {
          return false;
        }

        const rawFlightId = ticket?.flightId;
        const nestedFlight = ticket?.flight;

        const candidateIds = [
          this.normalizeFlightId(rawFlightId),
          this.normalizeFlightId(rawFlightId && typeof rawFlightId === 'object' ? rawFlightId._id : null),
          this.normalizeFlightId(rawFlightId && typeof rawFlightId === 'object' ? rawFlightId.id : null),
          this.normalizeFlightId(nestedFlight?._id),
          this.normalizeFlightId(nestedFlight?.id),
          this.normalizeFlightId(nestedFlight?.flightId),
        ].filter(Boolean);

        return !!targetFlightId && candidateIds.includes(targetFlightId);
      })
      .map((ticket) => this.normalizeSeatCode(ticket?.seat))
      .filter(Boolean);

    return Array.from(new Set(occupiedSeats));
  }

  private toRawTicketArray(response: RawTicketLike[] | { success?: boolean; tickets?: RawTicketLike[] }): RawTicketLike[] {
    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response?.tickets) ? response.tickets : [];
  }

  private toBookingRecordArray(
    response: { success?: boolean; tickets?: BookingRecord[] } | BookingRecord[]
  ): BookingRecord[] {
    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response?.tickets) ? response.tickets : [];
  }

  private normalizeFlightResponse(response: { success?: boolean; flight?: Flight } | Flight): Flight {
    if (response && typeof response === 'object' && 'flight' in response) {
      return (response.flight || ({} as Flight)) as Flight;
    }

    return (response || ({} as Flight)) as Flight;
  }

  private enrichFlightFaresIfMissing(flight: Flight, flightId: string): Observable<Flight> {

    const hasEconomy = this.toPositiveNumber((flight as any).priceEconomy ?? flight.economyPrice) !== null;
    const hasBusiness = this.toPositiveNumber((flight as any).priceBusiness ?? (flight as any).priceBussiness ?? flight.businessPrice) !== null;

    if (hasEconomy && hasBusiness) {
      return of(flight);
    }

    return this.http.get<ApiFlightDoc[]>(`${this.baseUrl}/flights`).pipe(
      map((flights) => {
        const targetId = this.normalizeFlightId(flightId);
        const matched = (Array.isArray(flights) ? flights : []).find((item) => {
          const ids = [item?._id, item?.id, item?.flightId]
            .map((value) => this.normalizeFlightId(value))
            .filter(Boolean);
          return !!targetId && ids.includes(targetId);
        });

        if (!matched) {
          return flight;
        }

        const fallbackEconomy = this.toPositiveNumber(matched.priceEconomy);
        const fallbackBusiness = this.toPositiveNumber(matched.priceBusiness ?? matched.priceBussiness);

        return {
          ...flight,
          priceEconomy: (flight as any).priceEconomy ?? (fallbackEconomy ?? undefined),
          economyPrice: flight.economyPrice ?? (fallbackEconomy ?? undefined),
          priceBusiness: (flight as any).priceBusiness ?? (fallbackBusiness ?? undefined),
          priceBussiness: (flight as any).priceBussiness ?? (fallbackBusiness ?? undefined),
          businessPrice: flight.businessPrice ?? (fallbackBusiness ?? undefined),
        } as Flight;
      }),
      catchError(() => of(flight))
    );
  }

  private normalizeFlightId(value: unknown): string | null {
    if (value && typeof value === 'object') {
      const maybe = value as { _id?: unknown; id?: unknown; flightId?: unknown; $oid?: unknown };
      return (
        this.normalizeFlightId(maybe._id) ||
        this.normalizeFlightId(maybe.id) ||
        this.normalizeFlightId(maybe.flightId) ||
        this.normalizeFlightId(maybe.$oid)
      );
    }

    const raw = String(value || '').trim();
    return raw ? raw.toLowerCase() : null;
  }

  private normalizeSeatCode(value: unknown): string {
    const compact = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!compact) {
      return '';
    }

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

    if (!/^[A-Z]\d{2}$/.test(compact)) {
      return compact;
    }

    return compact;
  }

  private normalizeSeatList(seats: unknown[]): string[] {
    return Array.from(new Set((seats || []).map((seat) => this.normalizeSeatCode(seat)).filter(Boolean)));
  }

  private normalizeBaggageOptionsResponse(
    response: { success?: boolean; options?: BaggageOption[]; data?: BaggageOption[]; items?: BaggageOption[] } | BaggageOption[]
  ): BaggageOption[] {
    const rawOptions = Array.isArray(response)
      ? response
      : Array.isArray(response?.options)
        ? response.options
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.items)
            ? response.items
            : [];

    return rawOptions
      .filter((option) => !!option)
      .map((option) => {
        const numericPrice = Number(option.price ?? 0);
        const safePrice = Number.isFinite(numericPrice) ? numericPrice : 0;

        return {
          ...option,
          price: safePrice,
          priceDisplay: option.priceDisplay || `${safePrice.toLocaleString('vi-VN')}đ`,
        } as BaggageOption;
      });
  }

  private toPositiveNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
}
