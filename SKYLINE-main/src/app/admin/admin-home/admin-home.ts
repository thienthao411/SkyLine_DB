import {
  Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import {
  DashboardService,
  TimePeriod, TimeFilter,
  OverviewData, ChartData, DonutStats, RouteData, AirlineData
} from '../services/dashboard.service';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './admin-home.html',
  styleUrls: ['./admin-home.css']
})
export class AdminHomeComponent implements OnInit, OnDestroy {

  // === LAYOUT ===
  sidebarOpen = true;
  currentUser: any = null;

  // === FILTER ===
  period: TimePeriod = 'month';
  customFrom = '';
  customTo = '';
  showFilterDropdown = false;
  filterLabel = 'Tháng này';
  periods: { key: TimePeriod; label: string }[] = [
    { key: 'day', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'year', label: 'Năm này' },
    { key: 'custom', label: 'Tùy chỉnh' }
  ];

  // === LOADING / ERROR ===
  loading = false;
  error = '';

  // === DATA ===
  overview: OverviewData = {
    totalRevenue: 0, totalTickets: 0, totalFlights: 0,
    seatFillRate: 0, cancellationRate: 0,
    revenueGrowth: 0, ticketGrowth: 0, flightGrowth: 0
  };
  revenueChart: ChartData = { labels: [], values: [] };
  ticketsChart: ChartData = { labels: [], values: [] };
  donutStats: DonutStats = { seatFillRate: 0, revenueGrowth: 0, planAttainment: 0 };
  topRoutes: RouteData[] = [];
  topAirlines: AirlineData[] = [];

  // === SVG CHART CONFIG ===
  readonly svgW = 900;
  readonly svgH = 220;
  readonly padX = 60;
  readonly padY = 30;

  private destroy$ = new Subject<void>();

  constructor(private dashService: DashboardService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const u = localStorage.getItem('currentUser');
    if (u) this.currentUser = JSON.parse(u);
    this.checkSidebarState();
    this.loadAll();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === FILTER ===

  selectPeriod(p: TimePeriod) {
    this.period = p;
    if (p !== 'custom') {
      this.applyFilter();
    }
  }

  applyFilter() {
    this.showFilterDropdown = false;
    this.filterLabel = this.buildFilterLabel();
    this.loadAll();
  }

  buildFilterLabel(): string {
    if (this.period === 'custom' && this.customFrom && this.customTo) {
      return `${this.customFrom} → ${this.customTo}`;
    }
    return this.periods.find(p => p.key === this.period)?.label ?? '';
  }

  toggleFilterDropdown() {
    this.showFilterDropdown = !this.showFilterDropdown;
  }

  getFilter(): TimeFilter {
    const f: TimeFilter = { period: this.period };
    if (this.period === 'custom') {
      f.from = this.customFrom;
      f.to = this.customTo;
    }
    return f;
  }

  // === DATA LOADING ===

  loadAll() {
    this.loading = true;
    this.error = '';
    const filter = this.getFilter();

    forkJoin({
      overview: this.dashService.getOverview(filter),
      revenue: this.dashService.getRevenueChart(filter),
      tickets: this.dashService.getTicketsChart(filter),
      donut: this.dashService.getDonutStats(filter),
      routes: this.dashService.getTopRoutes(filter),
      airlines: this.dashService.getTopAirlines(filter)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.overview?.success) this.overview = res.overview.data;
        if (res.revenue?.success) this.revenueChart = res.revenue.data;
        if (res.tickets?.success) this.ticketsChart = res.tickets.data;
        if (res.donut?.success) this.donutStats = res.donut.data;
        if (res.routes?.success) this.topRoutes = res.routes.data;
        if (res.airlines?.success) this.topAirlines = res.airlines.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Không thể kết nối tới API. Vui lòng khởi động server backend.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // === FORMAT HELPERS ===

  formatRevenue(val: number): string {
    if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + 'B';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString('vi-VN');
  }

  formatNumber(val: number): string {
    return val.toLocaleString('vi-VN');
  }

  growthClass(val: number): string {
    return val >= 0 ? 'growth-up' : 'growth-down';
  }

  growthArrow(val: number): string {
    return val >= 0 ? '↑' : '↓';
  }

  absGrowth(val: number): number {
    return Math.abs(val);
  }

  // === SVG LINE CHART (Revenue) ===

  private computePoints(values: number[]): { x: number; y: number }[] {
    if (values.length === 0) return [];
    const maxVal = Math.max(...values, 1);
    const w = this.svgW - this.padX * 2;
    const h = this.svgH - this.padY * 2;
    return values.map((v, i) => ({
      x: this.padX + (i / Math.max(values.length - 1, 1)) * w,
      y: this.svgH - this.padY - (v / maxVal) * h
    }));
  }

  linePath(values: number[]): string {
    const pts = this.computePoints(values);
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) * 0.4;
      const cp2x = pts[i].x + (pts[i + 1].x - pts[i].x) * 0.6;
      d += ` C ${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  }

  areaPath(values: number[]): string {
    if (values.length === 0) return '';
    const pts = this.computePoints(values);
    const line = this.linePath(values);
    const bottom = this.svgH - this.padY;
    return `${line} L ${pts[pts.length - 1].x},${bottom} L ${pts[0].x},${bottom} Z`;
  }

  ptX(i: number, values: number[]): number {
    if (values.length === 0) return 0;
    const w = this.svgW - this.padX * 2;
    return this.padX + (i / Math.max(values.length - 1, 1)) * w;
  }

  ptY(i: number, values: number[]): number {
    const maxVal = Math.max(...values, 1);
    const h = this.svgH - this.padY * 2;
    return this.svgH - this.padY - (values[i] / maxVal) * h;
  }

  yAxisLabels(values: number[]): { label: string; y: number }[] {
    const maxVal = Math.max(...values, 1);
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => ({
      label: this.formatRevenue((maxVal / steps) * i),
      y: this.svgH - this.padY - ((maxVal / steps) * i / maxVal) * (this.svgH - this.padY * 2)
    }));
  }

  // xAxis label positions  (sampled for readability)
  xLabels(labels: string[]): { label: string; x: number }[] {
    if (labels.length === 0) return [];
    const total = labels.length;
    const maxShow = 12;
    const step = total <= maxShow ? 1 : Math.ceil(total / maxShow);
    const result: { label: string; x: number }[] = [];
    labels.forEach((lbl, i) => {
      if (i % step === 0 || i === total - 1) {
        result.push({
          label: lbl,
          x: this.padX + (i / Math.max(total - 1, 1)) * (this.svgW - this.padX * 2)
        });
      }
    });
    return result;
  }

  // === SVG BAR CHART (Tickets) ===

  barWidth(values: number[]): number {
    if (values.length === 0) return 0;
    const totalW = this.svgW - this.padX * 2;
    return Math.max(2, totalW / values.length * 0.6);
  }

  barX(i: number, values: number[]): number {
    if (values.length === 0) return 0;
    const totalW = this.svgW - this.padX * 2;
    const spacing = totalW / values.length;
    return this.padX + spacing * i + spacing * 0.2;
  }

  barH(val: number, values: number[]): number {
    const maxVal = Math.max(...values, 1);
    return (val / maxVal) * (this.svgH - this.padY * 2);
  }

  barY(val: number, values: number[]): number {
    return this.svgH - this.padY - this.barH(val, values);
  }

  // === DONUT CHART ===
  donutRadius = 38;

  donutStrokeDash(pct: number): string {
    const c = 2 * Math.PI * this.donutRadius;
    const filled = Math.min(100, Math.max(0, pct)) / 100 * c;
    return `${filled} ${c - filled}`;
  }

  // === TOP ROUTES: Progress bar width ===

  maxRouteTickets(): number {
    return Math.max(...this.topRoutes.map(r => r.tickets), 1);
  }

  routeBarW(tickets: number): number {
    return Math.round((tickets / this.maxRouteTickets()) * 100);
  }

  maxAirlineTickets(): number {
    return Math.max(...this.topAirlines.map(a => a.tickets), 1);
  }

  airlineBarW(tickets: number): number {
    return Math.round((tickets / this.maxAirlineTickets()) * 100);
  }

  // === GRID LINES ===
  gridLines(values: number[]): number[] {
    const steps = 4;
    const maxVal = Math.max(...values, 1);
    return Array.from({ length: steps + 1 }, (_, i) =>
      this.svgH - this.padY - (i / steps) * (this.svgH - this.padY * 2)
    );
  }

  trackByIndex(i: number) { return i; }

  // === SIDEBAR / RESPONSIVE ===
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }

  @HostListener('window:resize')
  checkSidebarState() { this.sidebarOpen = window.innerWidth > 768; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (window.innerWidth <= 768) {
      const target = e.target as HTMLElement;
      const sidebar = document.querySelector('app-admin-sidebar');
      const toggle = document.querySelector('.menu-toggle');
      if (this.sidebarOpen && sidebar && toggle &&
          !sidebar.contains(target) && !toggle.contains(target)) {
        this.sidebarOpen = false;
      }
    }
    const dropdown = document.querySelector('.filter-dropdown-wrap');
    if (this.showFilterDropdown && dropdown && !dropdown.contains(e.target as Node)) {
      this.showFilterDropdown = false;
    }
  }
}
