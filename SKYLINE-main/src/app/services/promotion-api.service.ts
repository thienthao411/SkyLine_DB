import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PromotionApiItem {
  image: string;
  label: string;
  date: string;
  details: string;
  isFeatured?: boolean;
  startDate?: string;
  endDate?: string;
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
  isFeatured?: boolean;
  items: PromotionApiItem[];
}

export interface FeaturedPromotionItem {
  id: string;
  promotionId: string;
  category: string;
  itemIndex: number;
  image: string;
  title: string;
  shortDescription: string;
  discountValueRaw: number | null;
  discountRuleType: 'percentage' | 'amount';
  discountBadge: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  promoCode: string;
  target: string;
  applyChannel: string;
  isFeatured: boolean;
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

  getFeatured(options?: {
    limit?: number;
    sortBy?: 'newest' | 'highestDiscount';
  }): Observable<FeaturedPromotionItem[]> {
    const query: string[] = [];

    if (options?.limit) {
      query.push(`limit=${encodeURIComponent(options.limit)}`);
    }

    if (options?.sortBy) {
      query.push(`sortBy=${encodeURIComponent(options.sortBy)}`);
    }

    const suffix = query.length > 0 ? `?${query.join('&')}` : '';
    return this.http.get<FeaturedPromotionItem[]>(`${this.apiUrl}/featured${suffix}`);
  }

  getFeaturedById(itemId: string): Observable<FeaturedPromotionItem> {
    return this.http.get<FeaturedPromotionItem>(`${this.apiUrl}/featured/${encodeURIComponent(itemId)}`);
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