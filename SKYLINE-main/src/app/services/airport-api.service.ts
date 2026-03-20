import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

export interface Airport {
  code: string;
  name: string;
  city: string;
  icao?: string;
  province?: string;
  country?: string;
  displayName?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AirportApiService {
  private readonly apiUrl = 'http://localhost:5000/api/airports';
  private airportsCache: Airport[] = [];
  private airportsByCode = new Map<string, Airport>();
  private airportsRequest$: Observable<Airport[]> | null = null;

  constructor(private http: HttpClient) {
    this.ensureAirportsLoaded().subscribe({
      next: () => {},
      error: () => {},
    });
  }

  searchAirports(q: string): Observable<Airport[]> {
    const keyword = String(q || '').trim();
    return this.ensureAirportsLoaded().pipe(
      map((airports) => (keyword ? this.filterAuthoritativeAirports(airports, keyword) : [...airports]))
    );
  }

  getAllAirports(): Observable<Airport[]> {
    return this.ensureAirportsLoaded().pipe(map((airports) => [...airports]));
  }

  getAirportByCode(code: string): Airport | undefined {
    const normalizedCode = String(code || '').trim().toUpperCase();
    return this.airportsByCode.get(normalizedCode);
  }

  private ensureAirportsLoaded(): Observable<Airport[]> {
    if (this.airportsCache.length) {
      return of([...this.airportsCache]);
    }

    if (!this.airportsRequest$) {
      this.airportsRequest$ = this.http.get<Airport[]>(this.apiUrl).pipe(
        map((items) => this.normalizeAirports(items)),
        tap((items) => {
          this.airportsCache = [...items];
          this.airportsByCode = new Map(items.map((airport) => [airport.code, airport] as const));
        }),
        catchError((error) => {
          this.airportsRequest$ = null;
          return throwError(() => error);
        }),
        shareReplay(1)
      );
    }

    return this.airportsRequest$;
  }

  private normalizeAirports(items: Airport[]): Airport[] {
    return (Array.isArray(items) ? items : []).map((airport) => {
      const code = String(airport?.code || '').trim().toUpperCase();
      const name = String(airport?.name || '').trim();
      const city = String(airport?.city || '').trim();
      const province = String(airport?.province || '').trim();
      const icao = String(airport?.icao || '').trim().toUpperCase();
      const country = String(airport?.country || '').trim();
      const displayName = String(airport?.displayName || '').trim() || `${code} - ${name}`;

      return {
        ...airport,
        code,
        name,
        city,
        province,
        icao,
        country,
        displayName,
        isActive: airport?.isActive !== false,
      };
    });
  }

  private filterAuthoritativeAirports(airports: Airport[], keyword: string): Airport[] {
    const normalizedKeyword = this.normalizeText(keyword);

    if (!normalizedKeyword) {
      return [...airports];
    }

    return airports
      .filter((airport) => {
        const haystacks = [
          airport.code,
          airport.icao,
          airport.name,
          airport.city,
          airport.province,
          airport.displayName,
        ]
          .filter(Boolean)
          .map((value) => this.normalizeText(String(value)));

        return haystacks.some((value) => value.includes(normalizedKeyword));
      })
      .sort((a, b) => {
        const scoreA = this.getMatchScore(a, keyword);
        const scoreB = this.getMatchScore(b, keyword);

        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.code.localeCompare(b.code);
      });
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  private getMatchScore(airport: Airport, keyword: string): number {
    const q = this.normalizeText(keyword);

    const code = this.normalizeText(airport.code || '');
    const icao = this.normalizeText(airport.icao || '');
    const name = this.normalizeText(airport.name || '');
    const city = this.normalizeText(airport.city || '');
    const province = this.normalizeText(airport.province || '');
    const displayName = this.normalizeText(airport.displayName || '');

    if (!q) return 999;

    if (code === q) return 0;
    if (icao === q) return 1;
    if (name === q) return 2;
    if (city === q) return 3;
    if (province === q) return 4;

    if (code.startsWith(q)) return 5;
    if (icao.startsWith(q)) return 6;
    if (name.startsWith(q)) return 7;
    if (city.startsWith(q)) return 8;
    if (province.startsWith(q)) return 9;
    if (displayName.startsWith(q)) return 10;

    if (code.includes(q)) return 11;
    if (icao.includes(q)) return 12;
    if (name.includes(q)) return 13;
    if (city.includes(q)) return 14;
    if (province.includes(q)) return 15;
    if (displayName.includes(q)) return 16;

    return 999;
  }
}
