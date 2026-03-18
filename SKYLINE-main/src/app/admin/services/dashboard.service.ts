import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface TimeFilter {
  period: TimePeriod;
  from?: string;
  to?: string;
}

export interface OverviewData {
  totalRevenue: number;
  totalTickets: number;
  totalFlights: number;
  seatFillRate: number;
  cancellationRate: number;
  revenueGrowth: number;
  ticketGrowth: number;
  flightGrowth: number;
}

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface RouteData {
  route: string;
  tickets: number;
  revenue: number;
}

export interface AirlineData {
  airline: string;
  airlineCode: string;
  tickets: number;
  revenue: number;
}

export interface DonutStats {
  seatFillRate: number;
  revenueGrowth: number;
  planAttainment: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly API = 'http://localhost:5000/api/dashboard';

  constructor(private http: HttpClient) {}

  private buildParams(filter: TimeFilter): HttpParams {
    let params = new HttpParams().set('period', filter.period);
    if (filter.from) params = params.set('from', filter.from);
    if (filter.to) params = params.set('to', filter.to);
    return params;
  }

  getOverview(filter: TimeFilter): Observable<{ success: boolean; data: OverviewData }> {
    return this.http.get<any>(`${this.API}/overview`, { params: this.buildParams(filter) });
  }

  getRevenueChart(filter: TimeFilter): Observable<{ success: boolean; data: ChartData }> {
    return this.http.get<any>(`${this.API}/revenue-chart`, { params: this.buildParams(filter) });
  }

  getTicketsChart(filter: TimeFilter): Observable<{ success: boolean; data: ChartData }> {
    return this.http.get<any>(`${this.API}/tickets-chart`, { params: this.buildParams(filter) });
  }

  getTopRoutes(filter: TimeFilter): Observable<{ success: boolean; data: RouteData[] }> {
    return this.http.get<any>(`${this.API}/top-routes`, { params: this.buildParams(filter) });
  }

  getTopAirlines(filter: TimeFilter): Observable<{ success: boolean; data: AirlineData[] }> {
    return this.http.get<any>(`${this.API}/top-airlines`, { params: this.buildParams(filter) });
  }

  getDonutStats(filter: TimeFilter): Observable<{ success: boolean; data: DonutStats }> {
    return this.http.get<any>(`${this.API}/donut-stats`, { params: this.buildParams(filter) });
  }
}
