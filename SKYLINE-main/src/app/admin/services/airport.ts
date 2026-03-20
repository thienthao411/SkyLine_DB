import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type AirportStatus = 'active' | 'inactive';

export interface Airport {
  id: string;
  code: string;
  name: string;
  city: string;
  icao: string;
  province: string;
  country: string;
  displayName: string;
  sortOrder: number;
  status: AirportStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiAirport {
  _id?: string;
  code?: string;
  name?: string;
  city?: string;
  icao?: string;
  province?: string;
  country?: string;
  displayName?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AirportService {
  private apiUrl = 'http://localhost:5000/api/airports';

  constructor(private http: HttpClient) {}

  getAirportsForAdmin(): Observable<Airport[]> {
    return this.http.get<ApiAirport[]>(`${this.apiUrl}/admin`).pipe(
      map((airports) => (Array.isArray(airports) ? airports : []).map((airport) => this.toAirport(airport)))
    );
  }

  createAirport(payload: Airport): Observable<Airport> {
    return this.http
      .post<ApiAirport>(this.apiUrl, this.toPayload(payload))
      .pipe(map((created) => this.toAirport(created)));
  }

  updateAirport(id: string, payload: Airport): Observable<Airport> {
    return this.http
      .put<ApiAirport>(`${this.apiUrl}/${encodeURIComponent(id)}`, this.toPayload(payload))
      .pipe(map((updated) => this.toAirport(updated)));
  }

  private toAirport(api: ApiAirport): Airport {
    const code = String(api.code || '').trim().toUpperCase();
    const name = String(api.name || '').trim();
    return {
      id: String(api._id || '').trim(),
      code,
      name,
      city: String(api.city || '').trim(),
      icao: String(api.icao || '').trim().toUpperCase(),
      province: String(api.province || '').trim(),
      country: String(api.country || '').trim(),
      displayName: String(api.displayName || '').trim() || `${code} - ${name}`,
      sortOrder: Number(api.sortOrder || 0),
      status: api.isActive === false ? 'inactive' : 'active',
      createdAt: api.createdAt,
      updatedAt: api.updatedAt
    };
  }

  private toPayload(airport: Airport): Record<string, unknown> {
    const code = String(airport.code || '').trim().toUpperCase();
    const name = String(airport.name || '').trim();
    return {
      code,
      name,
      city: String(airport.city || '').trim(),
      icao: String(airport.icao || '').trim().toUpperCase(),
      province: String(airport.province || '').trim(),
      country: String(airport.country || '').trim(),
      displayName: String(airport.displayName || '').trim() || `${code} - ${name}`,
      sortOrder: Number(airport.sortOrder || 0),
      isActive: airport.status === 'active'
    };
  }
}
