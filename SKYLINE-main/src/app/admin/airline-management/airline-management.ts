import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { Airline, AirlineService, AirlineStatus } from '../services/airline';

type AirlineTab = 'list' | 'form';
type AirlineFilter = 'all' | AirlineStatus;

@Component({
  selector: 'app-airline-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './airline-management.html',
  styleUrls: ['./airline-management.css']
})
export class AirlineManagement implements OnInit, OnDestroy {
  activeTab: AirlineTab = 'list';
  formMode: 'create' | 'edit' = 'create';
  showDeleteConfirm = false;
  airlineToDeleteId: string | null = null;
  showViewModal = false;
  airlineToView: Airline | null = null;
  logoPreviewUrl = '';
  selectedLogoName = '';
  selectedLogoFile: File | null = null;
  searchTerm = '';
  selectedAirline: AirlineFilter = 'all';
  airlines: Airline[] = [];
  currentPage = 1;
  itemsPerPage = 10;
  private localLogoPreviewUrl: string | null = null;

  formAirline: Airline = this.createEmptyAirline();

  constructor(private airlineService: AirlineService) {}

  ngOnInit(): void {
    this.loadAirlinesData();
  }

  ngOnDestroy(): void {
    this.clearLocalLogoPreview();
  }

  get filteredAirlines(): Airline[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.airlines
      .filter((airline) => this.selectedAirline === 'all' || airline.status === this.selectedAirline)
      .filter((airline) => {
        if (!term) {
          return true;
        }

        const combined =
          `${airline.airlineCode} ${airline.airlineName} ${airline.country} ${airline.hotline}`.toLowerCase();
        return combined.includes(term);
      })
      .sort((left, right) =>
        (left.airlineName || '').localeCompare(right.airlineName || '', 'vi', { sensitivity: 'base' })
      );
  }

  get paginatedAirlines(): Airline[] {
    if (this.filteredAirlines.length === 0) {
      return [];
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredAirlines.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAirlines.length / this.itemsPerPage);
  }

  get isFormInvalid(): boolean {
    const airline = this.formAirline;
    return (
      !airline.airlineCode.trim() ||
      !airline.airlineName.trim() ||
      !airline.country.trim() ||
      !airline.hotline.trim()
    );
  }

  get isEditMode(): boolean {
    return this.formMode === 'edit' && !!this.formAirline.id;
  }

  loadAirlinesData(): void {
    this.airlineService.getAirlines().subscribe({
      next: (data) => {
        this.airlines = data;
        this.ensureValidCurrentPage();
      },
      error: () => {
        alert('Không thể tải danh sách hãng bay từ máy chủ.');
        this.airlines = [];
      }
    });
  }

  onSearchChange(newValue: string): void {
    this.searchTerm = newValue;
    this.currentPage = 1;
  }

  onAirlineChange(_event?: Event): void {
    this.currentPage = 1;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] || null;
    this.selectedLogoFile = file;
    this.selectedLogoName = file?.name || '';

    if (file) {
      this.setLocalLogoPreview(file);
      return;
    }

    this.clearLocalLogoPreview();
    this.logoPreviewUrl = this.formAirline.img || '';
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  viewAirline(airline: Airline): void {
    this.airlineToView = this.cloneAirline(airline);
    this.showViewModal = true;
  }

  editAirline(airline: Airline): void {
    this.airlineToView = null;
    this.formAirline = this.cloneAirline(airline);
    this.clearLocalLogoPreview();
    this.logoPreviewUrl = this.formAirline.img || '';
    this.selectedLogoName = '';
    this.selectedLogoFile = null;
    this.formMode = 'edit';
    this.activeTab = 'form';
  }

  promptDelete(airline: Airline): void {
    if (!airline.id) {
      alert('Không tìm thấy mã hãng bay để xóa.');
      return;
    }

    this.airlineToDeleteId = airline.id;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (!this.airlineToDeleteId) {
      this.cancelDelete();
      return;
    }

    this.airlineService.softDeleteAirline(this.airlineToDeleteId).subscribe({
      next: () => {
        this.cancelDelete();
        this.loadAirlinesData();
      },
      error: () => {
        alert('Xóa hãng bay thất bại. Vui lòng thử lại.');
      }
    });
  }

  cancelDelete(): void {
    this.airlineToDeleteId = null;
    this.showDeleteConfirm = false;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.airlineToView = null;
  }

  cancelForm(): void {
    this.resetForm();
    this.activeTab = 'list';
  }

  addAirline(): void {
    const payload = this.prepareFormPayload(this.formAirline);
    this.airlineService.createAirline(payload, this.selectedLogoFile).subscribe({
      next: () => {
        this.loadAirlinesData();
        this.cancelForm();
        this.currentPage = 1;
      },
      error: () => {
        alert('Thêm hãng bay thất bại. Vui lòng kiểm tra dữ liệu và thử lại.');
      }
    });
  }

  updateAirline(): void {
    if (!this.formAirline.id) {
      alert('Lỗi: Không tìm thấy hãng bay để cập nhật.');
      return;
    }

    const payload = this.prepareFormPayload(this.formAirline);
    this.airlineService.updateAirline(this.formAirline.id, payload, this.selectedLogoFile).subscribe({
      next: () => {
        this.loadAirlinesData();
        this.cancelForm();
      },
      error: () => {
        alert('Cập nhật hãng bay thất bại. Vui lòng thử lại.');
      }
    });
  }

  navigateToAddForm(): void {
    this.switchTab('form');
  }

  switchTab(tab: AirlineTab): void {
    this.activeTab = tab;

    if (tab === 'form') {
      this.formMode = 'create';
      this.resetForm();
    }
  }

  formatStatus(status: AirlineStatus): string {
    if (status === 'inactive') {
      return 'Ngừng hợp tác';
    }

    if (status === 'deleted') {
      return 'Đã xóa';
    }

    return 'Đang hoạt động';
  }

  statusClass(status: AirlineStatus): string {
    if (status === 'inactive' || status === 'deleted') {
      return 'status-pill status-pill--inactive';
    }

    return 'status-pill status-pill--active';
  }

  private createEmptyAirline(): Airline {
    return {
      id: '',
      airlineCode: '',
      airlineName: '',
      img: '',
      country: '',
      hotline: '',
      commissionRate: 0,
      status: 'active'
    };
  }

  private resetForm(): void {
    this.formAirline = this.createEmptyAirline();
    this.clearLocalLogoPreview();
    this.logoPreviewUrl = '';
    this.selectedLogoName = '';
    this.selectedLogoFile = null;
  }

  private cloneAirline(airline: Airline): Airline {
    return { ...airline };
  }

  private clearLocalLogoPreview(): void {
    if (this.localLogoPreviewUrl) {
      URL.revokeObjectURL(this.localLogoPreviewUrl);
      this.localLogoPreviewUrl = null;
    }
  }

  private setLocalLogoPreview(file: File): void {
    this.clearLocalLogoPreview();
    this.localLogoPreviewUrl = URL.createObjectURL(file);
    this.logoPreviewUrl = this.localLogoPreviewUrl;
  }

  private prepareFormPayload(airline: Airline): Airline {
    return {
      ...airline,
      airlineCode: (airline.airlineCode || '').trim().toUpperCase(),
      airlineName: (airline.airlineName || '').trim(),
      country: (airline.country || '').trim(),
      hotline: (airline.hotline || '').trim(),
      commissionRate: Number(airline.commissionRate || 0),
      status: airline.status === 'inactive' ? 'inactive' : 'active'
    };
  }

  private ensureValidCurrentPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(this.totalPages, 1);
    }
  }
}
