import { Component, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { QRCodeComponent } from 'angularx-qrcode';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import localeVi from '@angular/common/locales/vi';

import { BookingService } from '../services/booking.service';

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

  constructor(private bookingService: BookingService) {

  }

  ngOnInit(): void {
    this.fetchTicketData();
  }

  fetchTicketData(): void {
    this.isLoading = true;

    const passenger = this.bookingService.getData('passengerInfo');
    const amount = this.bookingService.getData('totalAmount');
    const code = this.bookingService.getData('ticketCode');
    const dateStr = this.bookingService.getData('bookingDate');

    const flight = this.bookingService.getData('selectedFlight');
    const seat = this.bookingService.getData('selectedSeat');

    if (passenger && amount && code && dateStr && flight && seat) {

      const bookingDateObj = new Date(dateStr);
      this.paymentDeadline = new Date(bookingDateObj.getTime() + 15 * 60 * 1000);

      this.ticketInfo = {
        name: passenger.fullName,
        phone: passenger.phoneNumber,
        bookingDate: bookingDateObj,
        email: passenger.email
      };

      this.totalAmount = amount;
      this.qrData = code;

      this.flightDetails = flight;
      this.seatDetails = seat;

      this.isLoading = false;
    } else {
      console.error('Không tìm thấy thông tin đặt vé đầy đủ từ service.');
      this.isLoading = false;
    }
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