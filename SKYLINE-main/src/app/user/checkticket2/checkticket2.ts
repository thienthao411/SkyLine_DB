import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { BookingApiService, BookingRecord } from '../services/booking-api.service';

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
    private bookingApiService: BookingApiService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      if (!code) {
        this.ticketDetail = undefined;
        return;
      }

      this.bookingApiService.getTicket(code).subscribe({
        next: (record) => {
          this.ticketDetail = this.toTicketDetail(record);
        },
        error: () => {
          this.ticketDetail = undefined;
          console.warn('Không tìm thấy vé với mã:', code);
        }
      });
    });
  }

  private toTicketDetail(record: BookingRecord): Ticket {
    const statusText = record.status === 'paid' || record.status === 'issued' ? 'Đã thanh toán' : 'Chờ thanh toán';

    return {
      code: record.ticketCode,
      name: String(record.passengerInfo?.['fullName'] || '').trim(),
      seat: record.seat,
      status: statusText,
      route: `${record.flight.from} - ${record.flight.to}`,
      phone: String(record.passengerInfo?.['phoneNumber'] || record.passengerInfo?.['phone'] || '').trim(),
      email: String(record.passengerInfo?.['email'] || '').trim(),
      departure: this.formatDateTime(record.flight.departTime),
      arrival: this.formatDateTime(record.flight.arriveTime),
      bookingDate: this.formatDateTime(record.bookingDate),
      price: Number(record.totalAmount || 0),
    };
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = date.toLocaleDateString('vi-VN');
    return `${time} - ${day}`;
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
      const depDate = this.parseDisplayDateTime(departure);
      const arrDate = this.parseDisplayDateTime(arrival);

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

  private parseDisplayDateTime(value: string): Date {
    const [timeRaw, dateRaw] = value.split(' - ').map((part) => part.trim());
    if (!timeRaw || !dateRaw) {
      return new Date('invalid');
    }

    const [day, month, year] = dateRaw.split('/').map((part) => Number(part));
    const [hour, minute] = timeRaw.split(':').map((part) => Number(part));

    return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
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
