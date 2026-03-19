import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private readonly router = inject(Router);
  private ticketData: Record<string, unknown> = {};

  constructor() {
    // Booking data is temporary for one booking flow only.
    // Clean legacy persisted keys so stale data won't leak between sessions.
    localStorage.removeItem('ticketData');
    localStorage.removeItem('bookingData');

    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (!this.isBookingFlowUrl(event.url)) {
          this.clearData();
        }
      });
  }

  setData(key: string, value: unknown) {
    this.ticketData[key] = value;
  }

  getData<T = unknown>(key: string): T | null {
    return (this.ticketData[key] as T | undefined) ?? null;
  }

  getAllData() {
    return { ...this.ticketData };
  }

  clearData() {
    this.ticketData = {};
    localStorage.removeItem('ticketData');
    localStorage.removeItem('bookingData');
  }

  private isBookingFlowUrl(url: string): boolean {
    const cleanUrl = String(url || '').split('?')[0].toLowerCase();
    const bookingRoutePrefixes = [
      '/seat-selection',
      '/baggage-selection',
      '/confirmation',
      '/checkout',
      '/ket-qua-thanh-toan',
    ];

    return bookingRoutePrefixes.some((prefix) => cleanUrl.startsWith(prefix));
  }
}
