import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

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

  constructor(private router: Router) {}

  onSubmit() {
    // Validate inputs
    if (!this.email || !this.password) {
      this.showMessage('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    // Simple admin login check (you can enhance this with backend API)
    if (this.email === 'admin@skyline.com' && this.password === 'admin123') {
      // Store admin user
      const adminUser = {
        email: this.email,
        name: 'Admin',
        isAdmin: true
      };
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      
      this.showMessage('Đăng nhập thành công!', 'success');
      setTimeout(() => {
        this.router.navigate(['/admin-home']);
      }, 1000);
    } else {
      this.showMessage('Email hoặc mật khẩu không đúng', 'error');
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
