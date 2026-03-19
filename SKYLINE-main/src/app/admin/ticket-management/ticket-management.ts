import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { ActivatedRoute, Router } from '@angular/router';
import { TicketFull, TicketService } from '../services/ticket';

@Component({
  selector: 'app-ticket-management',
  imports: [CommonModule, AdminSidebarComponent, AdminHeader, FormsModule],
  templateUrl: './ticket-management.html',
  styleUrls: ['./ticket-management.css'],
})

export class TicketManagement implements OnInit {
  activeTab: 'ticket' | 'transaction' = 'ticket';
  allData: TicketFull[] = [];
  tickets: TicketFull[] = [];
  transactions: TicketFull[] = [];

  statusFilter: string = 'all';
  searchTerm: string = '';
  isDatePopoverOpen: boolean = false;
  tempStartDate: string | null = null;
  tempEndDate: string | null = null;
  displayDateRange: string = 'Lọc theo thời gian';

  totalTicketsSold = 0;
  totalTransactions = 0;
  successfulTransactions = 0;
  newCustomers = 0;

  currentPageTickets = 1;
  itemsPerPage = 10;
  totalPagesTickets = 1;

  currentPageTransactions = 1;
  totalPagesTransactions = 1;
  isLoading = false;
  errorMessage = '';
  highlightedBookingId: string = '';
  private pendingBookingFromNotification: string = '';

  constructor(
    private ticketService: TicketService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const tab = String(params['tab'] || '').trim();
      const bookingId = String(params['bookingId'] || '').trim();

      if (tab === 'transaction') {
        this.activeTab = 'transaction';
      }

      if (bookingId) {
        this.pendingBookingFromNotification = bookingId;
      }
    });

    this.loadTicketsFull();
  }

  switchTab(tab: 'ticket' | 'transaction') {
    this.activeTab = tab;
  }

  private normalizeStatus(value: string): string {
    return value.trim().toLowerCase();
  }

  private resolveFilterStatus(value: string): string {
    const normalized = this.normalizeStatus(value);
    if (normalized === 'đang chờ đối soát' || normalized === 'processing') return 'processing';
    if (normalized === 'thất bại' || normalized === 'failed') return 'failed';
    if (normalized === 'đã thanh toán' || normalized === 'paid') return 'paid';
    if (normalized === 'hoàn thành' || normalized === 'completed') return 'completed';
    if (normalized === 'chờ thanh toán' || normalized === 'pending') return 'pending';
    if (normalized === 'hủy' || normalized === 'cancelled') return 'cancelled';
    return normalized;
  }

  private statusMatchesFilter(ticketStatus: string): boolean {
    if (this.statusFilter === 'all') {
      return true;
    }

    if (this.statusFilter === 'needs_verification') {
      return this.resolveFilterStatus(ticketStatus) === 'processing';
    }

    return this.resolveFilterStatus(ticketStatus) === this.statusFilter;
  }

  loadTicketsFull() {
    this.isLoading = true;
    this.errorMessage = '';

    this.ticketService.getTickets().subscribe({
      next: (data) => {
        this.allData = data;
        this.isLoading = false;

        // Thống kê
        this.totalTicketsSold = data.filter(item =>
          ['hoàn thành', 'đã thanh toán'].includes(item.status.toLowerCase())
        ).length;

        this.totalTransactions = data.filter(item => !!item.transaction_id).length;

        this.successfulTransactions = data.filter(item =>
          !!item.transaction_id && ['hoàn thành', 'đã thanh toán'].includes(item.status.toLowerCase())
        ).length;

        this.newCustomers = data.filter(item => item.status.toLowerCase() === 'chờ thanh toán').length;

        this.filterTickets();
        this.filterTransactions();
        this.focusBookingFromNotification();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Không thể tải dữ liệu vé từ máy chủ.';
        console.error('Lỗi load dữ liệu vé:', err);
      }
    });
  }

  navigateToAddForm() {
    this.router.navigate(['/admin/tickets/add']);
  }

  onSearchChange(term: string) {
    this.searchTerm = term.trim().toLowerCase();
    this.filterTickets();
    this.filterTransactions();
  }

  applyStatusFilter() {
    this.filterTickets();
    this.filterTransactions();
  }

  openDatePopover(event: Event) {
    event.stopPropagation();
    this.isDatePopoverOpen = true;
  }

  closeDatePopover() {
    this.isDatePopoverOpen = false;
  }

  private formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${y}-${m}-${d}`;
  }

  setQuickRange(days: number) {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    this.tempStartDate = this.formatDate(startDate);
    this.tempEndDate = this.formatDate(today);

    this.filterTickets();
    this.filterTransactions();
  }

  applyDateFilter() {
    this.isDatePopoverOpen = false;
    this.filterTickets();
    this.filterTransactions();

    if (this.tempStartDate && this.tempEndDate) {
      this.displayDateRange = `${this.tempStartDate} - ${this.tempEndDate}`;
    } else {
      this.displayDateRange = 'Lọc theo thời gian';
    }
  }

  // ------------------- FILTER -------------------
  filterTickets() {
    let filtered = [...this.allData];

    filtered = filtered.filter(item => this.statusMatchesFilter(item.status));

    if (this.tempStartDate && this.tempEndDate) {
      const start = new Date(this.tempStartDate);
      const end = new Date(this.tempEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const bookingDate = new Date(item.booking_date);
        return bookingDate >= start && bookingDate <= end;
      });
    }

    if (this.searchTerm) {
      filtered = filtered.filter(item =>
        item.ticket_code.toLowerCase().includes(this.searchTerm) ||
        item.flight_id.toLowerCase().includes(this.searchTerm));
    }

    this.tickets = filtered;
    this.totalPagesTickets = Math.ceil(this.tickets.length / this.itemsPerPage);
    this.currentPageTickets = 1;
  }

  filterTransactions() {
    let filtered = this.allData.filter(item => !!item.transaction_id);

    filtered = filtered.filter(item => this.statusMatchesFilter(item.payment_status || item.status));

    if (this.tempStartDate && this.tempEndDate) {
      const start = new Date(this.tempStartDate);
      const end = new Date(this.tempEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const bookingDate = new Date(item.booking_date);
        return bookingDate >= start && bookingDate <= end;
      });
    }

    if (this.searchTerm) {
      filtered = filtered.filter(item =>
        (item.transaction_id && item.transaction_id.toLowerCase().includes(this.searchTerm)) ||
        item.ticket_code.toLowerCase().includes(this.searchTerm)
      );
    }

    this.transactions = filtered;
    this.totalPagesTransactions = Math.ceil(this.transactions.length / this.itemsPerPage);
    this.currentPageTransactions = 1;
  }

  private focusBookingFromNotification(): void {
    const bookingId = this.pendingBookingFromNotification;
    if (!bookingId) {
      return;
    }

    const targetIndex = this.transactions.findIndex((item) => item.ticket_code === bookingId);
    if (targetIndex < 0) {
      return;
    }

    this.activeTab = 'transaction';
    this.currentPageTransactions = Math.floor(targetIndex / this.itemsPerPage) + 1;
    this.highlightedBookingId = bookingId;
    this.pendingBookingFromNotification = '';

    setTimeout(() => {
      const element = document.getElementById(`tx-${bookingId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  approvePayment(tx: TicketFull): void {
    this.ticketService.updatePaymentStatus(tx.ticket_code, 'paid').subscribe({
      next: () => {
        this.loadTicketsFull();
      },
      error: (err) => {
        this.errorMessage = 'Không thể xác nhận thanh toán cho đơn này.';
        console.error('Lỗi xác nhận thanh toán:', err);
      }
    });
  }

  rejectPayment(tx: TicketFull): void {
    this.ticketService.updatePaymentStatus(tx.ticket_code, 'failed').subscribe({
      next: () => {
        this.loadTicketsFull();
      },
      error: (err) => {
        this.errorMessage = 'Không thể từ chối thanh toán cho đơn này.';
        console.error('Lỗi từ chối thanh toán:', err);
      }
    });
  }

  canReviewPayment(tx: TicketFull): boolean {
    const status = this.resolveFilterStatus(tx.payment_status || tx.status);
    return status === 'processing' || status === 'pending';
  }

  // Modal
  isModalOpen: boolean = false;
  modalData: TicketFull | null = null;
  modalType: 'ticket' | 'transaction' = 'ticket';
  isEditMode: boolean = false;

  // ------------------- PAGINATION -------------------
  get pagedTickets() {
    const start = (this.currentPageTickets - 1) * this.itemsPerPage;
    return this.tickets.slice(start, start + this.itemsPerPage);
  }

  get pagedTransactions() {
    const start = (this.currentPageTransactions - 1) * this.itemsPerPage;
    return this.transactions.slice(start, start + this.itemsPerPage);
  }

  goToPageTickets(page: number) {
    if (page < 1 || page > this.totalPagesTickets) return;
    this.currentPageTickets = page;
  }

  goToPageTransactions(page: number) {
    if (page < 1 || page > this.totalPagesTransactions) return;
    this.currentPageTransactions = page;
  }

  // ------------------- ACTIONS -------------------
  onView(item: TicketFull) {
    this.modalData = { ...item };
    this.modalType = this.activeTab;
    this.isModalOpen = true;
    this.isEditMode = false;
  }

  // bật chế độ sửa
  enableEdit() {
    this.isEditMode = true;
  }

  // lưu thay đổi
  saveModalChanges() {
    if (!this.modalData) return;

    if (!this.modalData.id) {
      this.errorMessage = 'Không tìm thấy ID vé để cập nhật.';
      return;
    }

    this.ticketService.updateTicket(this.modalData.id, this.modalData).subscribe({
      next: (updated) => {
        const index = this.allData.findIndex((item) => item.id === updated.id);

        if (index >= 0) {
          this.allData[index] = updated;
        }

        this.filterTickets();
        this.filterTransactions();
        this.modalData = { ...updated };
        this.isEditMode = false;
      },
      error: (err) => {
        this.errorMessage = 'Cập nhật vé thất bại.';
        console.error('Lỗi cập nhật vé:', err);
      }
    });
  }

  closeModal() {
    this.isModalOpen = false;
    this.modalData = null;
    this.isEditMode = false;
  }


  onEdit(item: TicketFull) {
    this.modalData = { ...item };
    this.modalType = this.activeTab;
    this.isModalOpen = true;
    this.isEditMode = true;
  }

  getStatusStyle(status: string): Record<string, string> {
    const normalized = (status || '').toLowerCase();
    const base = {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
      border: '1px solid transparent'
    };

    if (normalized === 'hoàn thành') {
      return { ...base, background: '#dcfce7', color: '#166534', borderColor: '#86efac' };
    }

    if (normalized === 'đã thanh toán') {
      return { ...base, background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' };
    }

    if (normalized === 'chờ thanh toán') {
      return { ...base, background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' };
    }

    if (normalized === 'hủy') {
      return { ...base, background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' };
    }

    return { ...base, background: '#f3f4f6', color: '#374151' };
  }
}
