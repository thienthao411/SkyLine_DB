import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { FlightService, Flight, AirlineCatalogItem } from '../services/flight';
import { AdminHeader } from '../shared/header/admin-header/admin-header';

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
  activeTab: 'list' | 'form' = 'list';
  formMode: 'create' | 'edit' = 'create';
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
  airlineCatalogFromRepo: AirlineCatalogItem[] = [];
  readonly hourOptions: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly minuteOptions: string[] = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  readonly dayOptions: string[] = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  readonly monthOptions: string[] = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  readonly yearOptions: string[] = this.buildYearOptions();

  formFlight: Flight = this.createEmptyFlight();

  constructor(private flightService: FlightService, private el: ElementRef) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isDateInputInteraction(event)) {
      return;
    }

    if (!this.el.nativeElement.contains(event.target)) {
      this.isDatePopoverOpen = false;
    }
  }

  private isDateInputInteraction(event: MouseEvent): boolean {
    if (!this.isDatePopoverOpen) {
      return false;
    }

    const target = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;
    const dateInputIds = ['popover-start-date', 'popover-end-date'];

    if (target && dateInputIds.includes(target.id)) {
      return true;
    }

    if (activeElement && dateInputIds.includes(activeElement.id)) {
      return true;
    }

    return false;
  }

  ngOnInit(): void {
    this.loadFlights();
    this.loadAirlineCatalog();
  }

  loadFlights(): void {
    this.flightService.getFlights().subscribe({
      next: (data) => {
        this.flights = data;
        this.sortFlightsByDate();
        this.ensureValidCurrentPage();
      },
      error: () => {
        alert('Không thể tải danh sách chuyến bay từ máy chủ.');
      }
    });
  }

  loadAirlineCatalog(): void {
    this.flightService.getAirlineCatalog().subscribe({
      next: (data) => {
        this.airlineCatalogFromRepo = data;
      },
      error: () => {
        this.airlineCatalogFromRepo = [];
      }
    });
  }

  sortFlightsByDate(): void {
    this.flights.sort((a, b) => {
      const takeoffA = this.toDate(a.takeoffTime).getTime();
      const takeoffB = this.toDate(b.takeoffTime).getTime();
      if (takeoffA > takeoffB) return -1;
      if (takeoffA < takeoffB) return 1;
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
        const combined = `${f.flightCode} ${f.airline} ${f.departure} ${f.destination} ${f.airlineCode || ''}`.toLowerCase();
        return combined.includes(term);
      });
  }

  get uniqueAirlines(): string[] {
    const set = new Set(this.flights.map(f => f.airline));
    return Array.from(set).sort();
  }

  get isFormInvalid(): boolean {
    return this.collectFormValidationErrors(this.formFlight).length > 0;
  }

  get formValidationMessages(): string[] {
    return this.collectFormValidationErrors(this.formFlight);
  }

  get routePreview(): string {
    const departure = this.formFlight.departure?.trim() || '...';
    const destination = this.formFlight.destination?.trim() || '...';
    return `${departure} -> ${destination}`;
  }

  get durationPreview(): string {
    const takeoff = this.toDate(this.formFlight.takeoffTime);
    const landing = this.toDate(this.formFlight.landingTime);

    if (isNaN(takeoff.getTime()) || isNaN(landing.getTime())) {
      return 'Chưa hợp lệ';
    }

    const diffMs = landing.getTime() - takeoff.getTime();
    if (diffMs < 0) {
      return 'Chưa hợp lệ';
    }

    const mins = Math.round(diffMs / 60000);

    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes}p`;
    if (minutes === 0) return `${hours}g`;
    return `${hours}g ${minutes}p`;
  }

  get isTimeRangeInvalid(): boolean {
    const takeoff = this.toDate(this.formFlight.takeoffTime);
    const landing = this.toDate(this.formFlight.landingTime);

    if (isNaN(takeoff.getTime()) || isNaN(landing.getTime())) {
      return true;
    }

    return landing <= takeoff;
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
    const parsedStartDate = this.normalizeIsoDate(this.tempStartDate);
    const parsedEndDate = this.normalizeIsoDate(this.tempEndDate);

    if (this.tempStartDate.trim() && !parsedStartDate) {
      alert('Định dạng Từ ngày không hợp lệ. Vui lòng chọn lại ngày từ lịch.');
      return;
    }

    if (this.tempEndDate.trim() && !parsedEndDate) {
      alert('Định dạng Đến ngày không hợp lệ. Vui lòng chọn lại ngày từ lịch.');
      return;
    }

    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      alert('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.');
      return;
    }

    this.startDate = parsedStartDate || '';
    this.endDate = parsedEndDate || '';
    this.tempStartDate = this.startDate;
    this.tempEndDate = this.endDate;
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
    return `${day}/${month}/${year}`;
  }

  private normalizeIsoDate(isoDate: string): string | null {
    const value = (isoDate || '').trim();
    if (!value) {
      return '';
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(year, month - 1, day);

    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }

    return value;
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


  switchTab(tab: 'list' | 'form') {
    this.activeTab = tab;
    if (tab === 'form') {
      this.formMode = 'create';
      this.resetForm();
    }
  }

  navigateToAddForm() {
    this.formMode = 'create';
    this.resetForm();
    this.activeTab = 'form';
  }

  viewFlight(flight: Flight) {
    this.flightToView = this.cloneFlight(flight);
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.flightToView = null;
  }

  editFlight(flight: Flight) {
    if (this.isPastOrInOperationFlight(flight)) {
      alert('Chuyến bay đã hoặc đang khai thác, bạn chỉ có thể xem thông tin và không thể chỉnh sửa.');
      return;
    }

    this.flightToView = null;
    this.formFlight = this.cloneFlight(flight);
    this.formMode = 'edit';
    this.activeTab = 'form';
  }

  get isEditMode(): boolean {
    return this.formMode === 'edit' && !!this.formFlight.id;
  }

  onFlightCodeChange(value: string): void {
    this.formFlight.flightCode = (value || '').toUpperCase().replace(/\s+/g, '');
    if (!this.formFlight.airlineCode?.trim()) {
      this.formFlight.airlineCode = this.inferAirlineCodeFromFlightCode(this.formFlight.flightCode);
      if (this.formFlight.airlineCode) {
        this.formFlight.airline = this.getAirlineNameByCode(this.formFlight.airlineCode);
      }
    }
  }

  get airlineSelectionOptions(): Array<{ key: string; label: string; code: string; name: string }> {
    const lookup = new Map<string, { code: string; name: string }>();

    this.airlineCatalogFromRepo.forEach((item) => {
      lookup.set(item.code, item);
    });

    const currentCode = this.normalizeAirlineCode(this.formFlight.airlineCode);
    const currentName = (this.formFlight.airline || '').trim();
    if (currentCode && currentName && !lookup.has(currentCode)) {
      lookup.set(currentCode, { code: currentCode, name: currentName });
    }

    return Array.from(lookup.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => ({
        key: `${item.code}|${item.name}`,
        label: `${item.code} - ${item.name}`,
        code: item.code,
        name: item.name
      }));
  }

  get selectedAirlineOptionKey(): string {
    const code = this.normalizeAirlineCode(this.formFlight.airlineCode);
    const name = (this.formFlight.airline || '').trim();
    if (!code) {
      return '';
    }

    const matched = this.airlineSelectionOptions.find((item) => item.code === code);
    if (matched) {
      return matched.key;
    }

    return `${code}|${name || this.getAirlineNameByCode(code)}`;
  }

  onAirlineSelectionChange(value: string): void {
    const [codePart, ...nameParts] = (value || '').split('|');
    const code = this.normalizeAirlineCode(codePart);
    const name = nameParts.join('|').trim();

    this.formFlight.airlineCode = code;
    this.formFlight.airline = name || this.getAirlineNameByCode(code);
  }

  addFlight() {
    const payload: Flight = this.prepareFormPayload({ ...this.formFlight, id: '' });
    this.flightService.createFlight(payload).subscribe({
      next: () => {
        this.loadFlights();
        this.cancelForm();
        this.currentPage = 1;
      },
      error: () => {
        alert('Thêm chuyến bay thất bại. Vui lòng kiểm tra dữ liệu và thử lại.');
      }
    });
  }

  updateFlight() {
    if (!this.formFlight.id) {
      alert('Lỗi: Không tìm thấy chuyến bay để cập nhật.');
      return;
    }

    const existingFlight = this.flights.find(f => f.id === this.formFlight.id);
    if (existingFlight && this.isPastOrInOperationFlight(existingFlight)) {
      alert('Không thể cập nhật chuyến bay đã hoặc đang khai thác.');
      return;
    }

    const payload: Flight = this.prepareFormPayload(this.formFlight);

    this.flightService.updateFlight(this.formFlight.id, payload).subscribe({
      next: () => {
        this.loadFlights();
        this.cancelForm();
      },
      error: () => {
        alert('Cập nhật chuyến bay thất bại. Vui lòng thử lại.');
      }
    });
  }

  cancelForm() {
    this.formMode = 'create';
    this.resetForm();
    this.activeTab = 'list';
  }

  currentPage: number = 1;
  itemsPerPage: number = 10;

  get paginatedFlights(): Flight[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredFlights.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredFlights.length / this.itemsPerPage);
  }

  onSearchChange(newValue: string): void {
    this.searchTerm = newValue;
    this.currentPage = 1;
  }

  onAirlineChange(newValue: string): void {
    this.selectedAirline = newValue;
    this.currentPage = 1;
  }

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

  private ensureValidCurrentPage(): void {
    const pages = this.totalPages;
    if (pages === 0) {
      this.currentPage = 1;
      return;
    }

    if (this.currentPage > pages) {
      this.currentPage = pages;
    }

    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private toDate(time: Flight['takeoffTime']): Date {
    return new Date(`${time.year}-${time.month}-${time.day}T${time.hour}:${time.minute}:00`);
  }

  private getLandingDate(flight: Flight): Date {
    const t = flight.landingTime;
    return new Date(`${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}:00`);
  }

  getFlightStatusKey(flight: Flight): 'upcoming' | 'active' | 'expired' {
    const now = Date.now();
    const takeoff = this.toDate(flight.takeoffTime).getTime();
    const landing = this.getLandingDate(flight).getTime();

    if (takeoff > now) return 'upcoming';
    if (landing >= now) return 'active';
    return 'expired';
  }

  getFlightStatusLabel(flight: Flight): string {
    const status = this.getFlightStatusKey(flight);
    if (status === 'upcoming') return 'Sắp khởi hành';
    if (status === 'active') return 'Đang bay';
    return 'Đã hạ cánh';
  }

  getFlightStatusStyle(flight: Flight): Record<string, string> {
    const base = {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    };

    const status = this.getFlightStatusKey(flight);
    if (status === 'active') {
      return {
        ...base,
        background: '#D1FAE5',
        color: '#065F46'
      };
    }

    if (status === 'upcoming') {
      return {
        ...base,
        background: '#FEF9C3',
        color: '#A16207'
      };
    }

    return {
      ...base,
      background: '#FEE2E2',
      color: '#B91C1C'
    };
  }

  getSeatLoadText(flight: Flight): string {
    const booked = flight.seatsBookedTotal;
    const max = flight.seatsMax;

    if (typeof booked === 'number' && typeof max === 'number' && max > 0) {
      const ratio = Math.round((booked / max) * 100);
      return `${booked}/${max} (${ratio}%)`;
    }

    return 'Chưa cập nhật';
  }

  getPriceText(value: number | undefined, currency?: string): string {
    if (typeof value !== 'number') {
      return 'Chưa có';
    }

    const activeCurrency = currency || 'VND';
    if (activeCurrency.toUpperCase() === 'VND') {
      return `${Math.round(value).toLocaleString('vi-VN')} đ`;
    }

    return `${value.toLocaleString('en-US')} ${activeCurrency.toUpperCase()}`;
  }

  getDurationText(flight: Flight): string {
    const mins = flight.durationMin;
    if (typeof mins !== 'number' || mins < 0) {
      return 'Chưa có';
    }

    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;

    if (hours === 0) return `${minutes}p`;
    if (minutes === 0) return `${hours}g`;
    return `${hours}g ${minutes}p`;
  }

  getStopsText(flight: Flight): string {
    if (flight.stopsLabel?.trim()) {
      return flight.stopsLabel;
    }

    if (typeof flight.stops === 'number') {
      if (flight.stops === 0) return 'Bay thẳng';
      return `${flight.stops} điểm dừng`;
    }

    return 'Chưa có';
  }

  formatFlightDateTime(time: Flight['takeoffTime']): string {
    return `${time.hour}:${time.minute} • ${time.day}/${time.month}/${time.year.slice(2)}`;
  }

  isPastOrInOperationFlight(flight: Flight): boolean {
    const takeoff = this.toDate(flight.takeoffTime);
    return takeoff.getTime() <= Date.now();
  }

  private resetForm(): void {
    this.formFlight = this.createEmptyFlight();
  }

  private prepareFormPayload(input: Flight): Flight {
    const normalized = this.cloneFlight(input);

    normalized.flightCode = normalized.flightCode.trim().toUpperCase();
    normalized.departure = normalized.departure.trim();
    normalized.destination = normalized.destination.trim();
    normalized.airline = normalized.airline.trim();
    normalized.airlineCode = this.normalizeAirlineCode(
      normalized.airlineCode || this.inferAirlineCodeFromFlightCode(normalized.flightCode)
    );

    if (!normalized.airline && normalized.airlineCode) {
      normalized.airline = this.getAirlineNameByCode(normalized.airlineCode);
    }

    normalized.currency = 'VND';

    normalized.priceEconomy = this.normalizeOptionalNumber(normalized.priceEconomy);
    normalized.priceBusiness = this.normalizeOptionalNumber(normalized.priceBusiness);
    normalized.seatsMax = this.normalizeOptionalInteger(normalized.seatsMax);
    normalized.seatsBookedTotal = this.normalizeOptionalInteger(normalized.seatsBookedTotal);
    normalized.stops = this.normalizeOptionalInteger(normalized.stops);

    normalized.stopsLabel = this.buildStopsLabel(normalized.stops);

    const autoDuration = this.computeDurationMinutes(normalized);
    normalized.durationMin = autoDuration > 0 ? autoDuration : undefined;

    return normalized;
  }

  private computeDurationMinutes(flight: Flight): number {
    const takeoff = this.toDate(flight.takeoffTime);
    const landing = this.getLandingDate(flight);
    const diffMs = landing.getTime() - takeoff.getTime();

    if (isNaN(diffMs) || diffMs <= 0) {
      return 0;
    }

    return Math.round(diffMs / 60000);
  }

  private normalizeAirlineCode(code?: string): string {
    return (code || '').trim().toUpperCase();
  }

  private collectFormValidationErrors(f: Flight): string[] {
    const errors: string[] = [];

    if (!f.flightCode.trim()) {
      errors.push('Mã chuyến bay không được để trống.');
    }

    if (!f.airlineCode?.trim()) {
      errors.push('Vui lòng chọn hãng khai thác đang hoạt động.');
    }

    if (!f.departure.trim()) {
      errors.push('Sân bay khởi hành không được để trống.');
    }

    if (!f.destination.trim()) {
      errors.push('Sân bay đến không được để trống.');
    }

    if (f.departure.trim() && f.destination.trim() && f.departure.trim() === f.destination.trim()) {
      errors.push('Sân bay khởi hành và sân bay đến không được trùng nhau.');
    }

    if (this.isTimeRangeInvalid) {
      errors.push('Giờ đến (STA) phải sau giờ khởi hành (STD).');
    }

    if (typeof f.seatsMax !== 'number') {
      errors.push('Vui lòng nhập tổng số ghế khai thác.');
    }

    if (typeof f.priceEconomy !== 'number') {
      errors.push('Vui lòng nhập giá hạng phổ thông.');
    }

    if (typeof f.priceBusiness !== 'number') {
      errors.push('Vui lòng nhập giá hạng thương gia.');
    }

    if (typeof f.priceEconomy === 'number' && f.priceEconomy < 0) {
      errors.push('Giá phổ thông không được âm.');
    }

    if (typeof f.priceBusiness === 'number' && f.priceBusiness < 0) {
      errors.push('Giá thương gia không được âm.');
    }

    if (
      typeof f.priceEconomy === 'number' &&
      typeof f.priceBusiness === 'number' &&
      f.priceBusiness < f.priceEconomy
    ) {
      errors.push('Giá thương gia phải lớn hơn hoặc bằng giá phổ thông.');
    }

    if (typeof f.seatsMax === 'number' && f.seatsMax < 0) {
      errors.push('Tổng số ghế không được âm.');
    }

    if (typeof f.seatsBookedTotal === 'number' && f.seatsBookedTotal < 0) {
      errors.push('Số ghế đã đặt không được âm.');
    }

    if (
      typeof f.seatsMax === 'number' &&
      typeof f.seatsBookedTotal === 'number' &&
      f.seatsBookedTotal > f.seatsMax
    ) {
      errors.push('Số ghế đã đặt không được lớn hơn tổng số ghế.');
    }

    if (typeof f.stops === 'number' && (!Number.isInteger(f.stops) || f.stops < 0)) {
      errors.push('Số điểm dừng phải là số nguyên không âm.');
    }

    return errors;
  }

  private inferAirlineCodeFromFlightCode(flightCode: string): string {
    const normalized = (flightCode || '').trim().toUpperCase();
    const match = normalized.match(/^[A-Z0-9]{2}/);
    return match ? match[0] : '';
  }

  private getAirlineNameByCode(code: string): string {
    const fromRepo = this.airlineCatalogFromRepo.find((item) => item.code === code)?.name;
    if (fromRepo) {
      return fromRepo;
    }

    const codeNameMap: Record<string, string> = {
      VN: 'Vietnam Airlines',
      VJ: 'Vietjet Air',
      QH: 'Bamboo Airways',
      BL: 'Pacific Airlines',
      VU: 'Vietravel Airlines',
      '0V': 'VASCO'
    };

    return codeNameMap[code] || code;
  }

  private buildStopsLabel(stops: number | undefined): string {
    if (typeof stops !== 'number') {
      return '';
    }

    if (stops === 0) {
      return 'Bay thẳng';
    }

    return `${stops} điểm dừng`;
  }

  private normalizeOptionalNumber(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }

    return value;
  }

  private normalizeOptionalInteger(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }

    return Math.round(value);
  }

  private buildYearOptions(): string[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(currentYear - 1 + i));
  }

  private buildTimePartsFromDate(date: Date): Flight['takeoffTime'] {
    return {
      hour: String(date.getHours()).padStart(2, '0'),
      minute: String(date.getMinutes()).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: String(date.getFullYear())
    };
  }

  private createEmptyFlight(): Flight {
    const now = new Date();

    return {
      id: '',
      flightCode: '',
      airline: '',
      airlineCode: '',
      departure: '',
      destination: '',
      takeoffTime: this.buildTimePartsFromDate(now),
      landingTime: this.buildTimePartsFromDate(now),
      durationMin: undefined,
      currency: 'VND',
      priceEconomy: undefined,
      priceBusiness: undefined,
      seatsMax: undefined,
      seatsBookedTotal: undefined,
      stops: undefined,
      stopsLabel: '',
    };
  }

  private cloneFlight(flight: Flight): Flight {
    return JSON.parse(JSON.stringify(flight));
  }
}