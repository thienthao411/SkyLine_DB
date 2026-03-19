import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AirlineApiModel {
  _id?: string;
  airlineCode?: string;
  airlineName?: string;
  country?: string;
  hotline?: string;
  commissionRate?: number;
  status?: string;
  logo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AirlineApiService {
  private apiUrl = 'http://localhost:5000/api/airlines';

  constructor(private http: HttpClient) {}

  getAll(): Observable<AirlineApiModel[]> {
    return this.http.get<AirlineApiModel[]>(this.apiUrl);
  }
}
