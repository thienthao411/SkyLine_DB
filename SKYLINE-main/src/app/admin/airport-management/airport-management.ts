import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { Airport, AirportService, AirportStatus } from '../services/airport';

type AirportTab = 'list' | 'form';
type AirportFilter = 'all' | AirportStatus;

@Component({
  selector: 'app-airport-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './airport-management.html',
  styleUrls: ['./airport-management.css']
})
export class AirportManagement implements OnInit {
  activeTab: AirportTab = 'list';
  formMode: 'create' | 'edit' = 'create';
  showDeleteConfirm = false;
  airportToDeleteId: string | null = null;
  showViewModal = false;
  airportToView: Airport | null = null;
  searchTerm = '';
  selectedStatus: AirportFilter = 'all';
  airports: Airport[] = [];
  currentPage = 1;
  itemsPerPage = 10;

  formAirport: Airport = this.createEmptyAirport();

  constructor(private airportService: AirportService) {}

  ngOnInit(): void {
    this.loadAirportsData();
  }

  get filteredAirports(): Airport[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.airports
      .filter((airport) => this.selectedStatus === 'all' || airport.status === this.selectedStatus)
      .filter((airport) => {
        if (!term) return true;
        const combined =
          `${airport.code} ${airport.name} ${airport.icao} ${airport.province} ${airport.country}`.toLowerCase();
        return combined.includes(term);
      })
      .sort((left, right) =>
        (left.name || '').localeCompare(right.name || '', 'vi', { sensitivity: 'base' })
      );
  }

  get paginatedAirports(): Airport[] {
    if (this.filteredAirports.length === 0) return [];
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAirports.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAirports.length / this.itemsPerPage);
  }

  get isFormInvalid(): boolean {
    const airport = this.formAirport;
    return (
      !airport.code.trim() ||
      !airport.name.trim() ||
      !airport.icao.trim() ||
      !airport.province.trim() ||
      !airport.country.trim()
    );
  }

  get isEditMode(): boolean {
    return this.formMode === 'edit' && !!this.formAirport.id;
  }

  loadAirportsData(): void {
    this.airportService.getAirportsForAdmin().subscribe({
      next: (data) => {
        this.airports = data;
        this.ensureValidCurrentPage();
      },
      error: () => {
        alert('Không thể tải danh sách sân bay từ máy chủ.');
        this.airports = [];
      }
    });
  }

  onSearchChange(newValue: string): void {
    this.searchTerm = newValue;
    this.currentPage = 1;
  }

  onStatusChange(): void {
    this.currentPage = 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  viewAirport(airport: Airport): void {
    this.airportToView = { ...airport };
    this.showViewModal = true;
  }

  editAirport(airport: Airport): void {
    this.airportToView = null;
    this.formAirport = { ...airport };
    this.formMode = 'edit';
    this.activeTab = 'form';
  }

  promptDelete(airport: Airport): void {
    if (!airport.id) {
      alert('Không tìm thấy mã sân bay để cập nhật trạng thái.');
      return;
    }

    this.airportToDeleteId = airport.id;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (!this.airportToDeleteId) {
      this.cancelDelete();
      return;
    }

    const airport = this.airports.find((item) => item.id === this.airportToDeleteId);
    if (!airport) {
      this.cancelDelete();
      return;
    }

    this.airportService.updateAirport(this.airportToDeleteId, { ...airport, status: 'inactive' }).subscribe({
      next: () => {
        this.cancelDelete();
        this.loadAirportsData();
      },
      error: () => {
        alert('Cập nhật trạng thái sân bay thất bại. Vui lòng thử lại.');
      }
    });
  }

  cancelDelete(): void {
    this.airportToDeleteId = null;
    this.showDeleteConfirm = false;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.airportToView = null;
  }

  cancelForm(): void {
    this.resetForm();
    this.activeTab = 'list';
  }

  addAirport(): void {
    this.airportService.createAirport(this.prepareFormPayload(this.formAirport)).subscribe({
      next: () => {
        this.loadAirportsData();
        this.cancelForm();
        this.currentPage = 1;
      },
      error: () => {
        alert('Thêm sân bay thất bại. Vui lòng kiểm tra dữ liệu và thử lại.');
      }
    });
  }

  updateAirport(): void {
    if (!this.formAirport.id) {
      alert('Lỗi: Không tìm thấy sân bay để cập nhật.');
      return;
    }

    this.airportService.updateAirport(this.formAirport.id, this.prepareFormPayload(this.formAirport)).subscribe({
      next: () => {
        this.loadAirportsData();
        this.cancelForm();
      },
      error: () => {
        alert('Cập nhật sân bay thất bại. Vui lòng thử lại.');
      }
    });
  }

  switchTab(tab: AirportTab): void {
    this.activeTab = tab;
    if (tab === 'form') {
      this.formMode = 'create';
      this.resetForm();
    }
  }

  formatStatus(status: AirportStatus): string {
    return status === 'inactive' ? 'Ngừng hoạt động' : 'Đang hoạt động';
  }

  statusClass(status: AirportStatus): string {
    return status === 'inactive'
      ? 'status-pill status-pill--inactive'
      : 'status-pill status-pill--active';
  }

  private createEmptyAirport(): Airport {
    return {
      id: '',
      code: '',
      name: '',
      city: '',
      icao: '',
      province: '',
      country: 'Việt Nam',
      displayName: '',
      sortOrder: this.airports.length + 1,
      status: 'active'
    };
  }

  private resetForm(): void {
    this.formAirport = this.createEmptyAirport();
  }

  private prepareFormPayload(airport: Airport): Airport {
    const code = String(airport.code || '').trim().toUpperCase();
    const name = String(airport.name || '').trim();
    return {
      ...airport,
      code,
      name,
      icao: String(airport.icao || '').trim().toUpperCase(),
      province: String(airport.province || '').trim(),
      country: String(airport.country || '').trim(),
      displayName: String(airport.displayName || '').trim() || `${code} - ${name}`,
      sortOrder: Number(airport.sortOrder || 0),
      status: airport.status === 'inactive' ? 'inactive' : 'active'
    };
  }

  private ensureValidCurrentPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(this.totalPages, 1);
    }
  }
}
