import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

type ForgotStep = 'email' | 'otp' | 'reset' | 'done';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css'],
})
export class ForgotPasswordComponent {
  step: ForgotStep = 'email';
  email = '';
  otp = '';
  newPassword = '';
  confirmPassword = '';
  resetToken = '';
  expiresInMinutes = 10;
  isSubmitting = false;
  message = '';
  messageType: 'success' | 'error' = 'error';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async submitEmail(): Promise<void> {
    this.clearMessage();

    const normalizedEmail = this.email.trim().toLowerCase();
    if (!this.authService.validateEmail(normalizedEmail)) {
      this.showMessage('Vui lòng nhập email hợp lệ.', 'error');
      return;
    }

    this.isSubmitting = true;
    const result = await this.authService.forgotPassword(normalizedEmail);
    this.isSubmitting = false;

    if (!result.success) {
      this.showMessage(result.message, 'error');
      return;
    }

    this.email = normalizedEmail;
    this.expiresInMinutes = Number(result.expiresInMinutes || 10);
    this.step = 'otp';
    this.showMessage(result.message, 'success');
  }

  async submitOtp(): Promise<void> {
    this.clearMessage();

    const normalizedOtp = this.otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      this.showMessage('Mã OTP gồm 6 chữ số.', 'error');
      return;
    }

    this.isSubmitting = true;
    const result = await this.authService.verifyForgotPasswordOtp(this.email, normalizedOtp);
    this.isSubmitting = false;

    if (!result.success || !result.resetToken) {
      this.showMessage(result.message || 'Xác nhận OTP thất bại.', 'error');
      return;
    }

    this.resetToken = result.resetToken;
    this.step = 'reset';
    this.showMessage('Xác nhận OTP thành công. Hãy đặt mật khẩu mới.', 'success');
  }

  async submitResetPassword(): Promise<void> {
    this.clearMessage();

    if (!this.authService.validatePassword(this.newPassword)) {
      this.showMessage('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showMessage('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    this.isSubmitting = true;
    const result = await this.authService.resetForgottenPassword({
      email: this.email,
      resetToken: this.resetToken,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword,
    });
    this.isSubmitting = false;

    if (!result.success) {
      this.showMessage(result.message, 'error');
      return;
    }

    this.step = 'done';
    this.showMessage('Đổi mật khẩu thành công.', 'success');

    setTimeout(() => {
      this.router.navigate(['/customer-sign-in']);
    }, 1200);
  }

  async resendOtp(): Promise<void> {
    this.clearMessage();
    this.isSubmitting = true;
    const result = await this.authService.forgotPassword(this.email);
    this.isSubmitting = false;

    if (!result.success) {
      this.showMessage(result.message, 'error');
      return;
    }

    this.showMessage('Đã gửi lại mã OTP. Vui lòng kiểm tra email.', 'success');
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;
  }

  private clearMessage(): void {
    this.message = '';
  }
}
