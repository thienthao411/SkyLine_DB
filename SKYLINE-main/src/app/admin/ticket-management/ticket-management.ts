import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { Router } from '@angular/router';

interface TicketFull {
  ticket_code: string;
  flight_id: string;
  flight_internal_id: string;
  seat: string;
  promotion_id: string | null;
  booking_date: string;
  price: number;
  status: string;
  transaction_id: string;
  payment_method: string;
  complaint: string;
}

@Component({
  selector: 'app-ticket-management',
  imports: [CommonModule, AdminSidebarComponent, AdminHeader, HttpClientModule, FormsModule],
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

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit() {
    this.loadTicketsFull();
  }

  switchTab(tab: 'ticket' | 'transaction') {
    this.activeTab = tab;
  }

  loadTicketsFull() {
    this.http.get<TicketFull[]>('assets/data/tickets_full.json').subscribe({
      next: (data) => {
        this.allData = data;

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
      },
      error: (err) => console.error('❌ Lỗi load dữ liệu:', err)
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

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status.toLowerCase() === this.statusFilter.toLowerCase());
    }

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

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status.toLowerCase() === this.statusFilter.toLowerCase());
    }

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

    // cập nhật dữ liệu gốc
    const index = this.allData.findIndex(t =>
      (this.activeTab === 'ticket' && t.ticket_code === this.modalData!.ticket_code) ||
      (this.activeTab === 'transaction' && t.transaction_id === this.modalData!.transaction_id)
    );

    if (index >= 0) {
      this.allData[index] = { ...this.modalData };
      this.filterTickets();
      this.filterTransactions();
    }

    this.isEditMode = false;
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


  // state
  showDeleteConfirm: boolean = false;
  itemToDelete: TicketFull | null = null;

  // gọi khi nhấn nút xóa
  onDelete(item: TicketFull) {
    this.itemToDelete = item;
    this.showDeleteConfirm = true;
  }

  // khi nhấn hủy
  cancelDelete() {
    this.showDeleteConfirm = false;
    this.itemToDelete = null;
  }

  // khi nhấn xác nhận xóa
  confirmDelete() {
    if (!this.itemToDelete) return;

    const type = this.activeTab === 'ticket' ? 'vé' : 'giao dịch';

    if (this.activeTab === 'ticket') {
      this.allData = this.allData.filter(t => t.ticket_code !== this.itemToDelete!.ticket_code);
      this.filterTickets();
    } else {
      this.allData = this.allData.filter(t => t.transaction_id !== this.itemToDelete!.transaction_id);
      this.filterTransactions();
    }

    // reset modal
    this.cancelDelete();
  }
}
