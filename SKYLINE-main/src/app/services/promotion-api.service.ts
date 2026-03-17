import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PromotionApiItem {
  image: string;
  label: string;
  date: string;
  details: string;
  target: string;
  applyTime: {
    from: string;
    to: string;
  };
  promoCode: string;
  maxDiscountAmount?: number | null;
  discountValueRaw?: number | null;
  status?: string;
  flightRoutes?: string;
  ticketClass?: string;
  minTickets?: number | null;
  ruleType?: string;
  additionalCondition?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  minOrderValue?: number | null;
  territory?: string;
  applyCountType?: string;
  applyChannel?: string;
  customerTargetType?: string;
}

export interface PromotionApiModel {
  _id?: string;
  title: string;
  icon: string;
  category?: string;
  items: PromotionApiItem[];
}

@Injectable({
  providedIn: 'root'
})
export class PromotionApiService {
  private apiUrl = 'http://localhost:5000/api/promotions';

  constructor(private http: HttpClient) {}

  getAll(): Observable<PromotionApiModel[]> {
    return this.http.get<PromotionApiModel[]>(this.apiUrl);
  }

  create(payload: PromotionApiModel): Observable<PromotionApiModel> {
    return this.http.post<PromotionApiModel>(this.apiUrl, payload);
  }

  update(id: string, payload: PromotionApiModel): Observable<PromotionApiModel> {
    return this.http.put<PromotionApiModel>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}