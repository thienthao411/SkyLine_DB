import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Ticket {
  code: string;
  name: string;
  seat: string;
  status: string;
  route: string;
  phone: string;
  email: string;
  departure: string;
  arrival: string;
  bookingDate: string;
  price: number;
}

@Component({
  selector: 'app-checkticket2',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './checkticket2.html',
  styleUrls: ['./checkticket2.css']
})
export class CheckTicket2 implements OnInit {
  ticketDetail: Ticket | undefined;
  tickets: Ticket[] = [];

  // Modal state
  showModal = false;
  modalMessage = '';
  modalType: 'swap' | 'cancel' | '' = '';
  modalCallback: (() => void) | null = null;

  // Feedback popup state
  showFeedback = false;
  feedbackMessage = '';

  // Info popup state
  showInfoPopup = false;
  infoPopupTitle = '';
  infoMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.http.get<Ticket[]>('assets/data/example_ticket.json').subscribe({
      next: (data) => {
        this.tickets = data;

        this.route.queryParams.subscribe(params => {
          const code = params['code'];
          if (code) {
            this.ticketDetail = this.tickets.find(ticket => ticket.code === code);
          }

          if (!this.ticketDetail) {
            console.warn('Không tìm thấy vé với mã:', code);
          }
        });
      },
      error: (err) => {
        console.error('Lỗi khi đọc file JSON:', err);
      }
    });
  }

  goBack() {
    this.router.navigate(['/checkticket']);
  }

  // --- Modal xác nhận ---
  handleSwap() {
    this.modalMessage = 'Bạn có chắc chắn muốn đổi vé? Điều này có thể phát sinh chi phí.';
    this.modalType = 'swap';
    this.showModal = true;
    this.modalCallback = () => {
      this.showFeedbackPopup('Đã gửi yêu cầu đổi vé.');
    };
  }

  handleCancel() {
    this.modalMessage = 'Bạn có chắc chắn muốn hủy vé? Chính sách hoàn tiền sẽ được áp dụng.';
    this.modalType = 'cancel';
    this.showModal = true;
    this.modalCallback = () => {
      this.showFeedbackPopup('Đã gửi yêu cầu hủy vé.');
    };
  }

  confirmModal() {
    this.showModal = false;
    if (this.modalCallback) this.modalCallback();
    this.modalCallback = null;
  }

  cancelModal() {
    this.showModal = false;
    this.modalCallback = null;
  }

  // --- Feedback popup ---
  showFeedbackPopup(message: string) {
    this.feedbackMessage = message;
    this.showFeedback = true;

    setTimeout(() => {
      this.showFeedback = false;
      this.feedbackMessage = '';
    }, 2000);
  }

  // --- Tính duration chuyến bay ---
  calculateDuration(departure: string, arrival: string): string {
    try {
      const depParts = departure.split('-').map(p => p.trim());
      const arrParts = arrival.split('-').map(p => p.trim());

      const depDate = new Date(`${depParts[1]}T${depParts[0]}:00`);
      const arrDate = new Date(`${arrParts[1]}T${arrParts[0]}:00`);

      const diffMs = arrDate.getTime() - depDate.getTime();
      if (diffMs < 0) return '---';

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      return `${hours}h${minutes}m`;
    } catch (err) {
      console.error('Lỗi tính duration:', err);
      return '---';
    }
  }

  // --- Info popup ---
  // Tạo mảng dòng để hiển thị
  infoMessageLines: string[] = [];

  showPromo() {
    this.infoPopupTitle = 'Ưu đãi đặc biệt';
    this.infoMessageLines = [
      'Giảm 10% cho vé tiếp theo nếu đặt trước 7 ngày',
      'Tặng voucher ăn uống trên chuyến bay'
    ];
    this.showInfoPopup = true;
  }

  showBenefits() {
    this.infoPopupTitle = 'Quyền lợi hành khách';
    this.infoMessageLines = [
      'Hành lý xách tay miễn phí 10kg',
      'Ưu tiên check-in và lên máy bay'
    ];
    this.showInfoPopup = true;
  }

  closeInfoPopup() {
    this.showInfoPopup = false;
  }
}
