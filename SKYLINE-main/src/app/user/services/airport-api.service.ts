import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

const AUTHORITATIVE_AIRPORTS: Airport[] = [
  { icao: 'VVCT', code: 'VCA', name: 'Sân bay Quốc tế Cần Thơ', city: 'Cần Thơ', province: 'Cần Thơ', country: 'Việt Nam', displayName: 'VCA - Sân bay Quốc tế Cần Thơ', isActive: true },
  { icao: 'VVDN', code: 'DAD', name: 'Sân bay Quốc tế Đà Nẵng', city: 'Đà Nẵng', province: 'Đà Nẵng', country: 'Việt Nam', displayName: 'DAD - Sân bay Quốc tế Đà Nẵng', isActive: true },
  { icao: 'VVCI', code: 'HPH', name: 'Sân bay Quốc tế Cát Bi', city: 'Hải Phòng', province: 'Hải Phòng', country: 'Việt Nam', displayName: 'HPH - Sân bay Quốc tế Cát Bi', isActive: true },
  { icao: 'VVNB', code: 'HAN', name: 'Sân bay Quốc tế Nội Bài', city: 'Hà Nội', province: 'Hà Nội', country: 'Việt Nam', displayName: 'HAN - Sân bay Quốc tế Nội Bài', isActive: true },
  { icao: 'VVTS', code: 'SGN', name: 'Sân bay Quốc tế Tân Sơn Nhất', city: 'TP. Hồ Chí Minh', province: 'TP. Hồ Chí Minh', country: 'Việt Nam', displayName: 'SGN - Sân bay Quốc tế Tân Sơn Nhất', isActive: true },
  { icao: 'VVCR', code: 'CXR', name: 'Sân bay Quốc tế Cam Ranh', city: 'Khánh Hòa', province: 'Khánh Hòa', country: 'Việt Nam', displayName: 'CXR - Sân bay Quốc tế Cam Ranh', isActive: true },
  { icao: 'VVPQ', code: 'PQC', name: 'Sân bay Quốc tế Phú Quốc', city: 'Kiên Giang', province: 'Kiên Giang', country: 'Việt Nam', displayName: 'PQC - Sân bay Quốc tế Phú Quốc', isActive: true },
  { icao: 'VVDL', code: 'DLI', name: 'Sân bay Quốc tế Liên Khương', city: 'Lâm Đồng', province: 'Lâm Đồng', country: 'Việt Nam', displayName: 'DLI - Sân bay Quốc tế Liên Khương', isActive: true },
  { icao: 'VVVH', code: 'VII', name: 'Sân bay Quốc tế Vinh', city: 'Nghệ An', province: 'Nghệ An', country: 'Việt Nam', displayName: 'VII - Sân bay Quốc tế Vinh', isActive: true },
  { icao: 'VVPB', code: 'HUI', name: 'Sân bay Quốc tế Phú Bài', city: 'Huế', province: 'Thừa Thiên Huế', country: 'Việt Nam', displayName: 'HUI - Sân bay Quốc tế Phú Bài', isActive: true },
  { icao: 'VVVD', code: 'VDO', name: 'Sân bay Quốc tế Vân Đồn', city: 'Quảng Ninh', province: 'Quảng Ninh', country: 'Việt Nam', displayName: 'VDO - Sân bay Quốc tế Vân Đồn', isActive: true },
  { icao: 'VVDB', code: 'DIN', name: 'Sân bay Điện Biên', city: 'Điện Biên', province: 'Điện Biên', country: 'Việt Nam', displayName: 'DIN - Sân bay Điện Biên', isActive: true },
  { icao: 'VVDH', code: 'VDH', name: 'Sân bay Đồng Hới', city: 'Quảng Bình', province: 'Quảng Bình', country: 'Việt Nam', displayName: 'VDH - Sân bay Đồng Hới', isActive: true },
  { icao: 'VVTX', code: 'THD', name: 'Sân bay Thọ Xuân', city: 'Thanh Hóa', province: 'Thanh Hóa', country: 'Việt Nam', displayName: 'THD - Sân bay Thọ Xuân', isActive: true },
  { icao: 'VVCL', code: 'VCL', name: 'Sân bay Chu Lai', city: 'Quảng Nam', province: 'Quảng Nam', country: 'Việt Nam', displayName: 'VCL - Sân bay Chu Lai', isActive: true },
  { icao: 'VVTH', code: 'TBB', name: 'Sân bay Tuy Hòa', city: 'Phú Yên', province: 'Phú Yên', country: 'Việt Nam', displayName: 'TBB - Sân bay Tuy Hòa', isActive: true },
  { icao: 'VVRG', code: 'VKG', name: 'Sân bay Rạch Giá', city: 'Kiên Giang', province: 'Kiên Giang', country: 'Việt Nam', displayName: 'VKG - Sân bay Rạch Giá', isActive: true },
  { icao: 'VVPK', code: 'PXU', name: 'Sân bay Pleiku', city: 'Gia Lai', province: 'Gia Lai', country: 'Việt Nam', displayName: 'PXU - Sân bay Pleiku', isActive: true },
  { icao: 'VVBM', code: 'BMV', name: 'Sân bay Buôn Ma Thuột', city: 'Đắk Lắk', province: 'Đắk Lắk', country: 'Việt Nam', displayName: 'BMV - Sân bay Buôn Ma Thuột', isActive: true },
  { icao: 'VVPC', code: 'UIH', name: 'Sân bay Phù Cát', city: 'Bình Định', province: 'Bình Định', country: 'Việt Nam', displayName: 'UIH - Sân bay Phù Cát', isActive: true },
  { icao: 'VVCM', code: 'CAH', name: 'Sân bay Cà Mau', city: 'Cà Mau', province: 'Cà Mau', country: 'Việt Nam', displayName: 'CAH - Sân bay Cà Mau', isActive: true },
  { icao: 'VVCS', code: 'VCS', name: 'Sân bay Côn Đảo', city: 'Bà Rịa - Vũng Tàu', province: 'Bà Rịa - Vũng Tàu', country: 'Việt Nam', displayName: 'VCS - Sân bay Côn Đảo', isActive: true },
];

const AUTHORITATIVE_BY_CODE = new Map(
  AUTHORITATIVE_AIRPORTS.map((airport) => [airport.code, airport] as const)
);

@Injectable({ providedIn: 'root' })
export class AirportApiService {
  private API_BASE = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  searchAirports(q: string): Observable<Airport[]> {
    const keyword = String(q || '').trim();

    if (!keyword) {
      return of([...AUTHORITATIVE_AIRPORTS]);
    }

    const params = new HttpParams().set('q', keyword);

    return this.http.get<Airport[]>(`${this.API_BASE}/airports/search`, { params }).pipe(
      map((apiAirports) => this.mergeWithAuthoritativeList(apiAirports, keyword)),
      catchError(() => of(this.filterAuthoritativeAirports(keyword)))
    );
  }

  getAllAirports(): Observable<Airport[]> {
    return of([...AUTHORITATIVE_AIRPORTS]);
  }

  getAirportByCode(code: string): Airport | undefined {
    const normalizedCode = String(code || '').trim().toUpperCase();
    return AUTHORITATIVE_BY_CODE.get(normalizedCode);
  }

  private mergeWithAuthoritativeList(apiAirports: Airport[] | null | undefined, keyword: string): Airport[] {
    const merged = new Map<string, Airport>();

    (Array.isArray(apiAirports) ? apiAirports : []).forEach((airport) => {
      const normalized = this.normalizeAirport(airport);
      if (!normalized.code) return;

      const authoritative = AUTHORITATIVE_BY_CODE.get(normalized.code);
      merged.set(normalized.code, authoritative ? authoritative : normalized);
    });

    this.filterAuthoritativeAirports(keyword).forEach((airport) => {
      merged.set(airport.code, airport);
    });

    return Array.from(merged.values()).sort((a, b) => {
      const scoreA = this.getMatchScore(a, keyword);
      const scoreB = this.getMatchScore(b, keyword);

      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.code.localeCompare(b.code);
    });
  }

  private filterAuthoritativeAirports(keyword: string): Airport[] {
    const normalizedKeyword = this.normalizeText(keyword);

    if (!normalizedKeyword) {
      return [...AUTHORITATIVE_AIRPORTS];
    }

    return AUTHORITATIVE_AIRPORTS.filter((airport) => {
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
    }).sort((a, b) => {
      const scoreA = this.getMatchScore(a, keyword);
      const scoreB = this.getMatchScore(b, keyword);

      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.code.localeCompare(b.code);
    });
  }

  private normalizeAirport(airport: Airport): Airport {
    const code = String(airport?.code || '').trim().toUpperCase();
    const icao = String(airport?.icao || '').trim().toUpperCase();
    const name = String(airport?.name || '').trim();
    const city = String(airport?.city || airport?.province || '').trim();
    const province = String(airport?.province || city).trim();

    return {
      ...airport,
      code,
      icao: icao || undefined,
      name,
      city,
      province,
      country: airport?.country || 'Việt Nam',
      displayName: airport?.displayName || `${code} - ${name}`,
      isActive: airport?.isActive ?? true,
    };
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
