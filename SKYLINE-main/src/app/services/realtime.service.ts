import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private readonly serverUrl = 'http://localhost:5000';
  private socket: Socket | null = null;

  private ensureConnected(): Socket {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling']
      });
    }

    return this.socket;
  }

  joinAdminRoom(): void {
    this.ensureConnected().emit('join_admin');
  }

  joinBookingRoom(ticketCode: string): void {
    const code = String(ticketCode || '').trim();
    if (!code) {
      return;
    }
    this.ensureConnected().emit('join_booking', code);
  }

  joinUserRoom(email: string): void {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }
    this.ensureConnected().emit('join_user', normalizedEmail);
  }

  on<T = any>(eventName: string, listener: (payload: T) => void): () => void {
    const socket = this.ensureConnected();
    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }
}
