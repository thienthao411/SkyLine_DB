import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-information',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './information.html',
  styleUrl: './information.css',
})
export class Information implements OnInit {
  user: any = null;
  isEditing = false;

  // danh sách quốc gia gợi ý
  countries: string[] = [
    'Việt Nam',
    'Nhật Bản',
    'Hàn Quốc',
    'Hoa Kỳ',
    'Pháp',
    'Đức',
    'Anh',
    'Singapore'
  ];

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    // Kiểm tra xem user đã đăng nhập chưa
    if (!this.authService.isLoggedIn()) {
      console.warn('⚠️ User not logged in');
      return;
    }
    
    // Lấy thông tin user hiện tại
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ No current user found');
      return;
    }
    
    console.log('🔍 Current user email:', currentUser.email);
    
    // Ưu tiên lấy từ localStorage (nếu đã có và đầy đủ)
    const saved = localStorage.getItem('fullUserData');
    if (saved) {
      const userData = JSON.parse(saved);
      
      // Kiểm tra xem dữ liệu có đầy đủ không (phone, birthday, passport phải có giá trị)
      const hasCompleteData = userData.phone && userData.birthday && userData.passport;
      
      if (hasCompleteData) {
        this.user = userData;
        console.log('✅ Loaded complete user data from localStorage:', this.user);
        console.log('📊 User data details:', {
          phone: this.user.phone,
          birthday: this.user.birthday,
          passport: this.user.passport,
          passportExpiry: this.user.passportExpiry
        });
        return; // Đã có dữ liệu đầy đủ, không cần load từ JSON
      } else {
        console.warn('⚠️ localStorage data is incomplete, will reload from JSON');
        console.log('Current data:', {
          phone: userData.phone,
          birthday: userData.birthday,
          passport: userData.passport
        });
      }
    }
    
    // Nếu chưa có hoặc dữ liệu không đầy đủ → Load từ file JSON
    console.log('� Loading user data from API...');
    this.loadUserDataFromAPI(currentUser.email);
  }
  
  // Helper method để load dữ liệu từ JSON
  private loadUserDataFromAPI(email: string): void {

    console.log('🌐 Loading user data from API...');
  
    this.http.get<any>(`http://localhost:5000/api/users/email/${email}`)
      .subscribe({
  
        next: (user) => {
  
          console.log('✅ Loaded user from MongoDB:', user);
  
          this.user = user;
  
          localStorage.setItem('fullUserData', JSON.stringify(user));
  
        },
  
        error: (err) => {
  
          console.error('❌ Failed to load user from API:', err);
  
        }
  
      });
  
  }

  onEdit(): void {
    this.isEditing = true;
  }

  onSave(): void {
    this.isEditing = false;
    
    // Lưu vào fullUserData
    localStorage.setItem('fullUserData', JSON.stringify(this.user));
    
    // Đồng bộ với users array trong localStorage (nếu có)
    const usersJson = localStorage.getItem('users');
    if (usersJson) {
      const users = JSON.parse(usersJson);
      const currentUser = this.authService.getCurrentUser();
      
      if (currentUser) {
        const userIndex = users.findIndex((u: any) => u.email === currentUser.email);
        if (userIndex !== -1) {
          // Cập nhật thông tin user trong mảng
          users[userIndex] = {
            ...users[userIndex],
            name: this.user.fullName,
            phone: this.user.phone,
            birthday: this.user.birthday,
            gender: this.user.gender,
            passport: this.user.passport,
            passportExpiry: this.user.passportExpiry,
            country: this.user.country,
            address: this.user.address,
            avatar: this.user.avatar
          };
          localStorage.setItem('users', JSON.stringify(users));
          console.log('✅ Updated user in users array');
        }
      }
    }
    
    alert('✅ Thông tin đã được lưu thành công!');
  }

  // Debug method - có thể gọi từ console hoặc thêm nút tạm
  reloadUserData(): void {
    console.log('🔄 Reloading user data from JSON file...');
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      console.error('❌ No current user');
      alert('❌ Vui lòng đăng nhập lại!');
      return;
    }
    
    console.log('🔍 Looking for user:', currentUser.email);
    
    this.http.get<any[]>('assets/data/user_data.json').subscribe({
      next: (users) => {
        console.log('📦 Loaded', users.length, 'users from JSON');
        
        const foundUser = users.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
        
        if (foundUser) {
          this.user = { ...foundUser };
          localStorage.setItem('fullUserData', JSON.stringify(this.user));
          
          console.log('✅ Reloaded user data:', {
            fullName: this.user.fullName,
            email: this.user.email,
            phone: this.user.phone,
            birthday: this.user.birthday,
            passport: this.user.passport,
            passportExpiry: this.user.passportExpiry,
            address: this.user.address
          });
          
          alert(`✅ Đã tải lại dữ liệu thành công!\n\n` +
                `Họ tên: ${this.user.fullName}\n` +
                `Email: ${this.user.email}\n` +
                `Điện thoại: ${this.user.phone || 'Chưa có'}\n` +
                `Ngày sinh: ${this.user.birthday || 'Chưa có'}\n` +
                `Passport: ${this.user.passport || 'Chưa có'}`);
        } else {
          console.error('❌ User not found in JSON file');
          alert(`❌ Không tìm thấy thông tin cho email: ${currentUser.email}\n\nCó thể bạn đã đăng ký tài khoản mới.`);
        }
      },
      error: (err) => {
        console.error('❌ Error loading JSON:', err);
        alert('❌ Lỗi khi tải file JSON. Vui lòng kiểm tra console!');
      }
    });
  }
}