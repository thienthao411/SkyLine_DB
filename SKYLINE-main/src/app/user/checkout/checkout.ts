import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { QRCodeComponent } from 'angularx-qrcode';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import localeVi from '@angular/common/locales/vi';

import { BookingService } from '../services/booking.service';
import { BookingApiService, BookingRecord } from '../services/booking-api.service';

registerLocaleData(localeVi, 'vi');

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    QRCodeComponent,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css']
})
export class Checkout implements OnInit {

  paymentDeadline!: Date;
  ticketInfo: any = {};
  qrData: string = '';
  totalAmount: number = 0;
  isLoading: boolean = true;

  flightDetails: any = null;
  seatDetails: string = '';

  constructor(
    private bookingService: BookingService,
    private bookingApiService: BookingApiService
  ) {

  }

  ngOnInit(): void {
    this.fetchTicketData();
  }

  fetchTicketData(): void {
    this.isLoading = true;

    const code = this.bookingService.getData('ticketCode');
    if (!code) {
      console.error('Không tìm thấy mã đặt vé để tải checkout từ backend.');
      this.isLoading = false;
      return;
    }

    this.bookingApiService.getBooking(code).subscribe({
      next: (booking: BookingRecord) => {
        this.populateTicketData(booking);
        this.bookingService.setData('bookingSnapshot', booking);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Không thể tải booking từ backend:', error);
        const fallbackBooking = this.bookingService.getData('bookingSnapshot');
        if (fallbackBooking) {
          this.populateTicketData(fallbackBooking);
        }
        this.isLoading = false;
      }
    });
  }

  private populateTicketData(booking: BookingRecord): void {
    const bookingDateObj = new Date(booking.bookingDate);
    this.paymentDeadline = new Date(bookingDateObj.getTime() + 15 * 60 * 1000);

    this.ticketInfo = {
      name: booking.passengerInfo?.['fullName'],
      phone: booking.passengerInfo?.['phoneNumber'],
      bookingDate: bookingDateObj,
      email: booking.passengerInfo?.['email']
    };

    this.totalAmount = booking.totalAmount;
    this.qrData = booking.ticketCode;
    this.flightDetails = booking.flight;
    this.seatDetails = booking.seat;
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
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }
}