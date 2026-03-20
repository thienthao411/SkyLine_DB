import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BlogSection {
  heading: string;
  paragraphs: string[];
}

export interface BlogModel {
  _id?: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  readTime: string;
  excerpt: string;
  coverTone?: 'sunrise' | 'ocean' | 'forest' | 'night';
  coverImage?: string;
  highlights: string[];
  sections: BlogSection[];
  status: 'draft' | 'published';
  isFeatured: boolean;
  publishedAt?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogApiService {
  private apiUrl = 'http://localhost:5000/api/blogs';

  constructor(private http: HttpClient) {}

  getPublished(): Observable<BlogModel[]> {
    return this.http.get<BlogModel[]>(`${this.apiUrl}/published`);
  }

  getAll(): Observable<BlogModel[]> {
    return this.http.get<BlogModel[]>(this.apiUrl);
  }

  getBySlug(slug: string): Observable<BlogModel> {
    return this.http.get<BlogModel>(`${this.apiUrl}/slug/${encodeURIComponent(slug)}`);
  }

  create(payload: BlogModel): Observable<BlogModel> {
    return this.http.post<BlogModel>(this.apiUrl, payload);
  }

  update(id: string, payload: BlogModel): Observable<BlogModel> {
    return this.http.put<BlogModel>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
