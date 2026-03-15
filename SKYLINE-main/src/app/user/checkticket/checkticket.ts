import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

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

  constructor(private router: Router, private http: HttpClient) { }

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

    this.http.get<Ticket[]>('assets/data/example_ticket.json').subscribe({
      next: (data) => {
        this.tickets = data.filter(t => t.email?.trim().toLowerCase() === this.currentUser);
        this.filteredTickets = [...this.tickets];
        if (this.tickets.length === 0) {
          console.warn('Không tìm thấy vé cho user:', this.currentUser);
        }
      },
      error: (err) => {
        console.error('Lỗi khi đọc file JSON:', err);
      }
    });
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
