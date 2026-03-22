import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiChatResponse {
  success: boolean;
  sessionId: string;
  reply: string;
  provider: string;
  model: string;
  fallback?: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiChatApiService {
  private readonly apiUrl = 'http://localhost:5000/api/ai/chat';

  constructor(private http: HttpClient) {}

  sendMessage(payload: { message: string; sessionId?: string; resetContext?: boolean }): Observable<AiChatResponse> {
    return this.http.post<AiChatResponse>(this.apiUrl, payload);
  }
}
