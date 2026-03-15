import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-customer-sign-up',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './customer-sign-up.html',
  styleUrls: ['./customer-sign-up.css']
})
export class CustomerSignUpComponent {
  name: string = '';
  email: string = '';
  password: string = '';  
  confirmPassword: string = '';
  message: string = '';
  messageType: 'success' | 'error' = 'error';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    // Validate inputs
    if (this.name.trim().length < 2) {
      this.showMessage('Họ tên phải có ít nhất 2 ký tự!', 'error');
      return;
    }

    if (!this.authService.validateEmail(this.email)) {
      this.showMessage('Vui lòng nhập email hợp lệ!', 'error');
      return;
    }

    if (!this.authService.validatePassword(this.password)) {
      this.showMessage('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.showMessage('Mật khẩu xác nhận không khớp!', 'error');
      return;
    }

    // Attempt registration (async)
    this.authService.register(this.name, this.email, this.password)
      .then(result => {
        if (result.success) {
          this.showMessage(result.message, 'success');
          setTimeout(() => {
            this.router.navigate(['/customer-sign-in']);
          }, 900);
        } else {
          this.showMessage(result.message, 'error');
        }
      })
      .catch(() => this.showMessage('Lỗi khi đăng ký, thử lại sau.', 'error'));
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;

    setTimeout(() => {
      this.message = '';
    }, 3000);
  }
}