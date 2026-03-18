import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';

export interface TicketFull {
  id: string;
  ticket_code: string;
  flight_id: string;
  flight_internal_id: string;
  seat: string;
  promotion_id: string | null;
  promotion_internal_id: string | null;
  booking_date: string;
  price: number;
  status: string;
  transaction_id: string;
  payment_method: string;
  complaint: string;
}

interface ApiTicket {
  _id?: string;
  ticketCode?: string;
  userId?: string;
  flightId?: string;
  promotionId?: string | null;
  seat?: string;
  status?: string;
  price?: number;
  totalPrice?: number;
  paymentMethod?: string;
  transactionId?: string;
  bookingDate?: string;
  complaint?: boolean;
}

interface ApiFlight {
  _id?: string;
  flightId?: string;
  flightNo?: string;
}

interface ApiPromotionItem {
  _id?: string;
  promoCode?: string;
}

interface ApiPromotion {
  _id?: string;
  items?: ApiPromotionItem[];
}

interface TicketUpdatePayload {
  ticketCode: string;
  flightId: string;
  promotionId: string | null;
  seat: string;
  bookingDate: string;
  price: number;
  status: string;
  transactionId: string;
  paymentMethod: string;
  complaint: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = 'http://localhost:5000/api/tickets';
  private flightApiUrl = 'http://localhost:5000/api/flights';
  private promotionApiUrl = 'http://localhost:5000/api/promotions';

  constructor(private http: HttpClient) {}

  getTickets(): Observable<TicketFull[]> {
    return forkJoin({
      tickets: this.http.get<ApiTicket[]>(this.apiUrl),
      flights: this.http.get<ApiFlight[]>(this.flightApiUrl),
      promotions: this.http.get<ApiPromotion[]>(this.promotionApiUrl)
    }).pipe(
      map(({ tickets, flights, promotions }) => {
        const flightNoLookup = this.buildFlightNoLookup(Array.isArray(flights) ? flights : []);
        const promoCodeLookup = this.buildPromoCodeLookup(Array.isArray(promotions) ? promotions : []);
        return (Array.isArray(tickets) ? tickets : []).map((item) =>
          this.toTicketFull(item, flightNoLookup, promoCodeLookup)
        );
      })
    );
  }

  updateTicket(id: string, payload: TicketFull): Observable<TicketFull> {
    return this.http
      .put<ApiTicket>(`${this.apiUrl}/${encodeURIComponent(id)}`, this.toApiPayload(payload))
      .pipe(map((updated) => this.toTicketFull(updated)));
  }

  deleteTicket(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  private toTicketFull(
    api: ApiTicket,
    flightNoLookup?: Map<string, string>,
    promoCodeLookup?: Map<string, string>
  ): TicketFull {
    const ticketCode = (api.ticketCode || '').trim();
    const flightId = (api.flightId || '').trim();
    const promotionId = (api.promotionId || '').trim();
    const flightNo = flightNoLookup?.get(flightId) || flightId;
    const promoCode = promotionId ? promoCodeLookup?.get(promotionId) || promotionId : null;
    const totalPrice = Number(api.totalPrice);
    const ticketPrice = Number(api.price);

    return {
      id: api._id || '',
      ticket_code: ticketCode,
      flight_id: flightNo,
      flight_internal_id: flightId,
      seat: (api.seat || '').trim(),
      promotion_id: promoCode,
      promotion_internal_id: promotionId || null,
      booking_date: this.normalizeDate(api.bookingDate),
      price: Number.isFinite(totalPrice)
        ? totalPrice
        : Number.isFinite(ticketPrice)
          ? ticketPrice
          : 0,
      status: this.normalizeStatusToVietnamese(api.status),
      transaction_id: (api.transactionId || '').trim(),
      payment_method: (api.paymentMethod || '').trim(),
      complaint: api.complaint ? 'Có' : 'Không'
    };
  }

  private toApiPayload(ticket: TicketFull): TicketUpdatePayload {
    return {
      ticketCode: ticket.ticket_code,
      flightId: ticket.flight_internal_id || ticket.flight_id,
      promotionId: ticket.promotion_internal_id || null,
      seat: ticket.seat,
      bookingDate: this.normalizeDate(ticket.booking_date),
      price: Number(ticket.price || 0),
      status: this.normalizeStatusToVietnamese(ticket.status),
      transactionId: ticket.transaction_id,
      paymentMethod: ticket.payment_method,
      complaint: ticket.complaint === 'Có'
    };
  }

  private normalizeStatusToVietnamese(value?: string): string {
    const normalized = (value || '').trim().toLowerCase();

    if (!normalized) {
      return 'Chờ thanh toán';
    }

    if (
      normalized === 'hoàn thành' ||
      normalized === 'hoan thanh' ||
      normalized === 'completed' ||
      normalized === 'complete' ||
      normalized === 'success' ||
      normalized === 'successful'
    ) {
      return 'Hoàn thành';
    }

    if (
      normalized === 'đã thanh toán' ||
      normalized === 'da thanh toan' ||
      normalized === 'paid' ||
      normalized === 'payment_success' ||
      normalized === 'payment success'
    ) {
      return 'Đã thanh toán';
    }

    if (
      normalized === 'chờ thanh toán' ||
      normalized === 'cho thanh toan' ||
      normalized === 'pending' ||
      normalized === 'pending payment' ||
      normalized === 'unpaid' ||
      normalized === 'waiting_payment'
    ) {
      return 'Chờ thanh toán';
    }

    if (
      normalized === 'hủy' ||
      normalized === 'huy' ||
      normalized === 'cancelled' ||
      normalized === 'canceled' ||
      normalized === 'cancel'
    ) {
      return 'Hủy';
    }

    return 'Chờ thanh toán';
  }

  private buildFlightNoLookup(flights: ApiFlight[]): Map<string, string> {
    const lookup = new Map<string, string>();

    flights.forEach((flight) => {
      const id = (flight._id || '').trim();
      const flightNo = (flight.flightNo || '').trim();
      const flightBusinessId = (flight.flightId || '').trim();

      if (id && flightNo) {
        lookup.set(id, flightNo);
      }

      if (flightBusinessId && flightNo && !lookup.has(flightBusinessId)) {
        lookup.set(flightBusinessId, flightNo);
      }
    });

    return lookup;
  }

  private buildPromoCodeLookup(promotions: ApiPromotion[]): Map<string, string> {
    const lookup = new Map<string, string>();

    promotions.forEach((promotion) => {
      const promotionId = (promotion._id || '').trim();
      const items = Array.isArray(promotion.items) ? promotion.items : [];
      const firstPromoCode = items.map((item) => (item.promoCode || '').trim()).find((code) => !!code) || '';

      if (promotionId && firstPromoCode) {
        lookup.set(promotionId, firstPromoCode);
      }

      items.forEach((item) => {
        const itemId = (item._id || '').trim();
        const promoCode = (item.promoCode || '').trim();

        if (itemId && promoCode && !lookup.has(itemId)) {
          lookup.set(itemId, promoCode);
        }
      });
    });

    return lookup;
  }

  private normalizeDate(value?: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return value;
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}