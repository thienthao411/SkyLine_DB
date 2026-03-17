import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { BookingApiService, BookingRecord } from '../services/booking-api.service';

interface Ticket {
  code: string;
  name: string;
  seat: string;
  status: string;
  route: string;
  email: string;
}

@Component({
  selector: 'app-checkticket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  templateUrl: './checkticket.html',
  styleUrls: ['./checkticket.css']
})
export class CheckTicket implements OnInit {
  searchText: string = '';
  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  currentUser: string | null = null;

  constructor(private router: Router, private bookingApiService: BookingApiService) { }

  ngOnInit(): void {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) {
      console.warn('Chưa đăng nhập, không load vé.');
      return;
    }

    try {
      const userData = JSON.parse(savedUser);
      this.currentUser = userData.email?.trim().toLowerCase() || null; // convert lowercase
    } catch (err) {
      console.error('Lỗi đọc user từ localStorage:', err);
      return;
    }

    if (!this.currentUser) return;

    this.bookingApiService.getTickets(this.currentUser).subscribe({
      next: (records) => {
        this.tickets = records.map(record => this.toTicket(record));
        this.filteredTickets = [...this.tickets];
        if (this.tickets.length === 0) {
          console.warn('Không tìm thấy vé cho user:', this.currentUser);
        }
      },
      error: (err) => {
        console.error('Lỗi khi tải dữ liệu vé:', err);
      }
    });
  }

  private toTicket(record: BookingRecord): Ticket {
    const fullName = String(record.passengerInfo?.['fullName'] || '').trim();
    const email = String(record.passengerInfo?.['email'] || '').trim();
    const statusText = record.status === 'paid' || record.status === 'issued' ? 'Đã thanh toán' : 'Chờ thanh toán';

    return {
      code: record.ticketCode,
      name: fullName,
      seat: record.seat,
      status: statusText,
      route: `${record.flight.from} - ${record.flight.to}`,
      email,
    };
  }

  goToDetail(ticket: Ticket) {
    this.router.navigate(['/checkticket2'], { queryParams: { code: ticket.code } });
  }

  searchTicket() {
    const text = this.searchText.trim().toLowerCase();
    if (!text) {
      this.filteredTickets = [...this.tickets];
    } else {
      this.filteredTickets = this.tickets.filter(
        t => t.code.toLowerCase().includes(text) || t.seat.toLowerCase().includes(text)
      );
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
