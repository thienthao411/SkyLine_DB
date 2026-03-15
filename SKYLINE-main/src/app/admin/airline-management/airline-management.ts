import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';

interface Airline {
  airlineCode: string;
  airlineName: string;
  country: string;
  hotline: string;
  commissionRate: number;
  status: string;
  notes?: string;
  id?: number;
}

@Component({
  selector: 'app-airline-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminSidebarComponent,
    AdminHeader
  ],
  templateUrl: './airline-management.html',
  styleUrls: ['./airline-management.css']
})
export class AirlineManagement implements OnInit {
  activeTab: string = 'list';
  showDeleteConfirm = false;
  airlineToDeleteId: string | null = null;
  showViewModal = false;
  airlineToView: Airline | null = null;
  searchTerm: string = '';
  selectedAirline: string = 'all';
  airlines: Airline[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;

  emptyFormAirline: Airline = {
    airlineCode: '',
    airlineName: '',
    country: '',
    hotline: '',
    commissionRate: 0,
    status: 'Đang hợp tác'
  };

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadAirlinesData();
  }

  loadAirlinesData(): void {
    this.http.get<Airline[]>('assets/data/airlines.json').subscribe((data) => {
      this.airlines = data;
    });
  }

  get filteredAirlines(): Airline[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.airlines
      .filter(f => this.selectedAirline === 'all' || f.status === this.selectedAirline)
      .filter(f => {
        if (!term) return true;
        const combined = `${f.airlineCode} ${f.airlineName} ${f.country}`.toLowerCase();
        return combined.includes(term);
      });
  }

  get paginatedFlights(): Airline[] {
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
    const f = this.emptyFormAirline;
    return !f.airlineCode.trim() || !f.airlineName.trim() || !f.country.trim() || !f.hotline.trim();
  }

  onSearchChange(newValue: string): void {
    this.searchTerm = newValue;
    this.currentPage = 1;
  }

  onAirlineChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    if (selectElement) {
      this.selectedAirline = selectElement.value;
      this.currentPage = 1;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  viewAirline(airline: Airline) {
    this.airlineToView = JSON.parse(JSON.stringify(airline));
    this.showViewModal = true;
  }

  editAirline(airline: Airline) {
    this.airlineToView = null;
    this.emptyFormAirline = JSON.parse(JSON.stringify(airline));
    this.activeTab = 'form';
  }

  promptDelete(airlineCode: string) {
    this.airlineToDeleteId = airlineCode;
    this.showDeleteConfirm = true;
  }

  confirmDelete() {
    if (this.airlineToDeleteId !== null) {
      this.airlines = this.airlines.filter(a => a.airlineCode !== this.airlineToDeleteId);
    }
    this.cancelDelete();
  }

  cancelDelete() {
    this.airlineToDeleteId = null;
    this.showDeleteConfirm = false;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.airlineToView = null;
  }

  cancelForm() {
    this.emptyFormAirline = { ...this.emptyFormAirline };
    this.activeTab = 'list';
  }

  addAirline() {
    this.emptyFormAirline.airlineCode = this.emptyFormAirline.airlineCode.toUpperCase();
    this.airlines.push({ ...this.emptyFormAirline });
    this.airlines.sort((a, b) => a.airlineCode.localeCompare(b.airlineCode));
    this.cancelForm();
  }

  updateAirline() {
    const index = this.airlines.findIndex(a => a.airlineCode === this.emptyFormAirline.airlineCode);
    if (index !== -1) {
      this.airlines[index] = { ...this.emptyFormAirline };
      this.cancelForm();
    } else {
      alert('Lỗi: Không tìm thấy hãng bay để cập nhật.');
    }
  }

  navigateToAddForm() {
    this.emptyFormAirline = { ...this.emptyFormAirline };
    this.activeTab = 'form';
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'form') {
      this.emptyFormAirline = { ...this.emptyFormAirline };
    }
  }
}
