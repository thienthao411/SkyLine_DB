import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-customer-sign-in',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './customer-sign-in.html',
  styleUrls: ['./customer-sign-in.css']
})
export class CustomerSignInComponent {
  email: string = '';
  password: string = '';
  message: string = '';
  messageType: 'success' | 'error' = 'error';
  private redirectTo = '';
  private redirectCode = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.email = (this.route.snapshot.queryParamMap.get('email') || '').trim();
    this.redirectTo = (this.route.snapshot.queryParamMap.get('redirectTo') || '').trim();
    this.redirectCode = (this.route.snapshot.queryParamMap.get('code') || '').trim();
  }

  onSubmit(): void {
    // Validate inputs
    if (!this.authService.validateEmail(this.email)) {
      this.showMessage('Vui lòng nhập email hợp lệ!', 'error');
      return;
    }

    if (!this.authService.validatePassword(this.password)) {
      this.showMessage('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
      return;
    }

    // Attempt login (uses async service)
    this.authService.login(this.email, this.password)
      .then(result => {
        if (result.success) {
          this.showMessage(result.message, 'success');
          setTimeout(() => {
            if (this.redirectTo === '/checkticket2' && this.redirectCode) {
              this.router.navigate(['/checkticket2', this.redirectCode]);
              return;
            }

            this.router.navigate(['home']);
          }, 800);
        } else {
          this.showMessage(result.message, 'error');
        }
      })
      .catch(() => {
        this.showMessage('Lỗi khi đăng nhập, thử lại sau.', 'error');
      });
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    this.message = message;
    this.messageType = type;

    setTimeout(() => {
      this.message = '';
    }, 3000);
  }
}