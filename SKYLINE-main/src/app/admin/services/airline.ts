import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type AirlineStatus = 'active' | 'inactive' | 'deleted';

export interface Airline {
  id: string;
  airlineCode: string;
  airlineName: string;
  img: string;
  country: string;
  hotline: string;
  commissionRate: number;
  status: AirlineStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiAirline {
  _id?: string;
  airlineCode?: string;
  airlineName?: string;
  img?: string;
  country?: string;
  hotline?: string;
  commissionRate?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AirlineService {
  private apiUrl = 'http://localhost:5000/api/airlines';

  constructor(private http: HttpClient) {}

  getAirlines(includeDeleted = false): Observable<Airline[]> {
    const suffix = includeDeleted ? '?includeDeleted=true' : '';
    return this.http.get<ApiAirline[]>(`${this.apiUrl}${suffix}`).pipe(
      map((airlines) =>
        (Array.isArray(airlines) ? airlines : []).map((airline) => this.toAirline(airline))
      )
    );
  }

  createAirline(payload: Airline, logoFile?: File | null): Observable<Airline> {
    return this.http
      .post<ApiAirline>(this.apiUrl, this.toFormData(payload, logoFile))
      .pipe(map((created) => this.toAirline(created)));
  }

  updateAirline(id: string, payload: Airline, logoFile?: File | null): Observable<Airline> {
    return this.http
      .put<ApiAirline>(`${this.apiUrl}/${encodeURIComponent(id)}`, this.toFormData(payload, logoFile))
      .pipe(map((updated) => this.toAirline(updated)));
  }

  softDeleteAirline(id: string): Observable<Airline> {
    return this.http
      .put<ApiAirline>(`${this.apiUrl}/${encodeURIComponent(id)}`, { status: 'deleted' })
      .pipe(map((updated) => this.toAirline(updated)));
  }

  private toAirline(api: ApiAirline): Airline {
    return {
      id: (api._id || '').trim(),
      airlineCode: (api.airlineCode || '').trim().toUpperCase(),
      airlineName: (api.airlineName || '').trim(),
      img: (api.img || '').trim(),
      country: (api.country || '').trim(),
      hotline: (api.hotline || '').trim(),
      commissionRate: Number(api.commissionRate || 0),
      status: this.normalizeStatus(api.status),
      createdAt: api.createdAt,
      updatedAt: api.updatedAt
    };
  }

  private toFormData(airline: Airline, logoFile?: File | null): FormData {
    const formData = new FormData();
    formData.append('airlineCode', (airline.airlineCode || '').trim().toUpperCase());
    formData.append('airlineName', (airline.airlineName || '').trim());
    formData.append('country', (airline.country || '').trim());
    formData.append('hotline', (airline.hotline || '').trim());
    formData.append('commissionRate', String(Number(airline.commissionRate || 0)));
    formData.append('status', this.normalizeStatus(airline.status));

    if (logoFile) {
      formData.append('img', logoFile);
    }

    return formData;
  }

  private normalizeStatus(value?: string): AirlineStatus {
    const normalized = (value || '').trim().toLowerCase();

    if (
      normalized === 'inactive' ||
      normalized === 'ngừng hợp tác' ||
      normalized === 'ngung hop tac' ||
      normalized === 'ngunghoptac'
    ) {
      return 'inactive';
    }

    if (normalized === 'deleted') {
      return 'deleted';
    }

    if (
      normalized === 'đang hợp tác' ||
      normalized === 'dang hop tac' ||
      normalized === 'danghoptac' ||
      normalized === 'active'
    ) {
      return 'active';
    }

    return 'active';
  }
}
