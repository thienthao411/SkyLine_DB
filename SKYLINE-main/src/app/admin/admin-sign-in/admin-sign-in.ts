import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserApiService } from '../../services/user-api.service';

@Component({
  selector: 'app-admin-sign-in',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './admin-sign-in.html',
  styleUrl: './admin-sign-in.css',
})
export class AdminSignIn {
  email: string = '';
  password: string = '';
  message: string = '';
  messageType: 'success' | 'error' = 'success';
  isSubmitting = false;

  constructor(
    private router: Router,
    private userApiService: UserApiService
  ) {}

  async onSubmit() {
    if (this.isSubmitting) {
      return;
    }

    const normalizedEmail = String(this.email || '').trim().toLowerCase();
    const normalizedPassword = String(this.password || '').trim();

    // Validate inputs
    if (!normalizedEmail || !normalizedPassword) {
      this.showMessage('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      const response = await firstValueFrom(this.userApiService.login(normalizedEmail, normalizedPassword));

      if (!response?.success || !response?.user) {
        this.showMessage(response?.message || 'Đăng nhập thất bại', 'error');
        return;
      }

      const adminUser = {
        ...response.user,
        email: normalizedEmail,
        name: response.user?.fullName || 'Admin',
        isAdmin: true
      };

      if (response?.token) {
        localStorage.setItem('authToken', response.token);
      }

      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      this.showMessage('Đăng nhập thành công!', 'success');

      setTimeout(() => {
        this.router.navigate(['/admin-home']);
      }, 600);
    } catch (error: any) {
      const apiMessage =
        error?.error?.message ||
        error?.message ||
        'Không thể đăng nhập. Vui lòng kiểm tra backend và tài khoản.';
      this.showMessage(apiMessage, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  showMessage(msg: string, type: 'success' | 'error') {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 3000);
  }
}
