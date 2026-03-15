import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { FlightService } from '../services/flight';
import { AdminHeader } from '../shared/header/admin-header/admin-header';

interface Flight {
  id: number;
  flightCode: string;
  airline: string;
  departure: string;
  destination: string;
  takeoffTime: { hour: string; minute: string; day: string; month: string; year: string; };
  landingTime: { hour: string; minute: string; day: string; month: string; year: string; };
  notes: string;
}

@Component({
  selector: 'app-flight-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminSidebarComponent,
    AdminHeader
  ],
  templateUrl: './flight-management.html',
  styleUrls: ['./flight-management.css']
})
export class FlightManagement implements OnInit {
  activeTab: string = 'list';
  showDeleteConfirm = false;
  flightToDeleteId: number | null = null;
  showViewModal = false;
  flightToView: Flight | null = null;
  searchTerm: string = '';
  selectedAirline: string = 'all';
  startDate: string = '';
  endDate: string = '';
  isDatePopoverOpen: boolean = false;
  tempStartDate: string = '';
  tempEndDate: string = '';

  flights: Flight[] = [];

  emptyFormFlight: Flight = {
    id: 0,
    flightCode: '',
    airline: '',
    departure: '',
    destination: '',
    takeoffTime: { hour: '00', minute: '00', day: '01', month: '01', year: '2025' },
    landingTime: { hour: '00', minute: '00', day: '01', month: '01', year: '2025' },
    notes: ''
  };
  formFlight: Flight = { ...this.emptyFormFlight };

  constructor(private flightService: FlightService, private el: ElementRef) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isDatePopoverOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadFlights();
  }

  loadFlights(): void {
    this.flightService.getFlights().subscribe(data => {
      this.flights = data;
      this.sortFlightsByDate();
    });
  }

  sortFlightsByDate(): void {
    this.flights.sort((a, b) => {
      const dateStrA = `${a.takeoffTime.year}-${a.takeoffTime.month}-${a.takeoffTime.day}`;
      const dateStrB = `${b.takeoffTime.year}-${b.takeoffTime.month}-${b.takeoffTime.day}`;
      if (dateStrA > dateStrB) return -1;
      if (dateStrA < dateStrB) return 1;
      return 0;
    });
  }


  get filteredFlights(): Flight[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.flights
      .filter(f => this.selectedAirline === 'all' || f.airline === this.selectedAirline)

      .filter(f => {
        const flightDate = `${f.takeoffTime.year}-${f.takeoffTime.month}-${f.takeoffTime.day}`;
        if (this.startDate && flightDate < this.startDate) return false;
        if (this.endDate && flightDate > this.endDate) return false;
        return true;
      })

      .filter(f => {
        if (!term) return true;
        const combined = `${f.flightCode} ${f.departure} ${f.destination}`.toLowerCase();
        return combined.includes(term);
      });
  }

  get uniqueAirlines(): string[] {
    const set = new Set(this.flights.map(f => f.airline));
    return Array.from(set).sort();
  }

  get isFormInvalid(): boolean {
    const f = this.formFlight;
    return !f.flightCode.trim() || !f.departure.trim() || !f.airline.trim() || !f.destination.trim();
  }


  openDatePopover(event: MouseEvent) {
    event.stopPropagation();
    this.tempStartDate = this.startDate;
    this.tempEndDate = this.endDate;
    this.isDatePopoverOpen = true;
  }

  closeDatePopover() {
    this.isDatePopoverOpen = false;
  }

  applyDateFilter() {
    this.startDate = this.tempStartDate;
    this.endDate = this.tempEndDate;
    this.isDatePopoverOpen = false;
    this.currentPage = 1;
  }

  setQuickRange(days: number) {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);

    this.tempEndDate = this.formatDateForInput(today);
    this.tempStartDate = this.formatDateForInput(pastDate);
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateForDisplay(isoDate: string): string {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  }

  get displayDateRange(): string {
    if (this.startDate && this.endDate) {
      return `${this.formatDateForDisplay(this.startDate)} - ${this.formatDateForDisplay(this.endDate)}`;
    }
    if (this.startDate) {
      return `Từ ${this.formatDateForDisplay(this.startDate)}`;
    }
    if (this.endDate) {
      return `Đến ${this.formatDateForDisplay(this.endDate)}`;
    }
    return 'Tất cả thời gian';
  }


  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'form') {
      this.formFlight = { ...this.emptyFormFlight };
    }
  }

  navigateToAddForm() {
    this.formFlight = { ...this.emptyFormFlight };
    this.activeTab = 'form';
  }

  viewFlight(flight: Flight) {
    this.flightToView = JSON.parse(JSON.stringify(flight));
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.flightToView = null;
  }

  editFlight(flight: Flight) {
    this.flightToView = null;
    this.formFlight = JSON.parse(JSON.stringify(flight));
    this.activeTab = 'form';
  }

  promptDelete(id: number) {
    this.flightToDeleteId = id;
    this.showDeleteConfirm = true;
  }

  confirmDelete() {
    if (this.flightToDeleteId !== null) {
      this.flights = this.flights.filter(f => f.id !== this.flightToDeleteId);
      const newTotalPages = this.totalPages;
      if (this.currentPage > newTotalPages) {
        this.currentPage = newTotalPages;
      }
      if (this.currentPage === 0 && newTotalPages > 0) {
        this.currentPage = 1;
      }
    }
    this.cancelDelete();
  }

  cancelDelete() {
    this.flightToDeleteId = null;
    this.showDeleteConfirm = false;
  }

  addFlight() {
    this.formFlight.id = this.flights.length ? Math.max(...this.flights.map(f => f.id)) + 1 : 1;
    this.flights.push({ ...this.formFlight });
    this.sortFlightsByDate();
    this.cancelForm();
    this.currentPage = 1;
  }

  updateFlight() {
    const index = this.flights.findIndex(f => f.id === this.formFlight.id);
    if (index !== -1) {
      this.flights[index] = { ...this.formFlight };
      this.sortFlightsByDate();
      this.cancelForm();
    } else {
      alert('Lỗi: Không tìm thấy chuyến bay để cập nhật.');
    }
  }

  cancelForm() {
    this.formFlight = { ...this.emptyFormFlight };
    this.activeTab = 'list';
  }

  // Thuộc tính phân trang
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // Getter cho các chuyến bay đã phân trang
  get paginatedFlights(): Flight[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredFlights.slice(start, end);
  }

  // Getter tính tổng số trang
  get totalPages(): number {
    return Math.ceil(this.filteredFlights.length / this.itemsPerPage);
  }

  // Hàm reset trang khi tìm kiếm
  onSearchChange(newValue: string): void {
    this.searchTerm = newValue;
    this.currentPage = 1;
  }

  // Hàm reset trang khi lọc
  onAirlineChange(newValue: string): void {
    this.selectedAirline = newValue;
    this.currentPage = 1;
  }

  // Các hàm điều khiển trang
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }
}