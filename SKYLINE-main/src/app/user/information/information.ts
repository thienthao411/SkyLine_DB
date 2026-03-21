import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { User, UserApiService } from '../../services/user-api.service';

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
  showSavePopup = false;
  savePopupType: 'success' | 'error' = 'success';
  savePopupTitle = '';
  savePopupMessage = '';
  private popupTimer: ReturnType<typeof setTimeout> | null = null;

  get phoneDigits(): string {
    return String(this.user?.phone || '').replace(/\D/g, '');
  }

  get passportDigits(): string {
    return String(this.user?.passport || '').replace(/\D/g, '');
  }

  get isPhoneValid(): boolean {
    return this.phoneDigits.length === 10;
  }

  get isPassportValid(): boolean {
    return this.passportDigits.length === 12;
  }

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

  constructor(private authService: AuthService, private userApi: UserApiService) {}

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
        this.user = this.applyDisplayDateFields(userData);
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

    this.userApi.getByEmail(email)
      .subscribe({
  
        next: (user) => {
  
          console.log('✅ Loaded user from MongoDB:', user);
  
          this.user = this.applyDisplayDateFields(user);
  
          localStorage.setItem('fullUserData', JSON.stringify(this.user));
  
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
    if (!this.user) {
      this.showPopup('error', 'Không thể lưu', 'Không có dữ liệu người dùng để lưu.');
      return;
    }

    if (!this.isPhoneValid) {
      this.showPopup('error', 'Số điện thoại chưa hợp lệ', 'Số điện thoại phải gồm đúng 10 chữ số.');
      return;
    }

    if (!this.isPassportValid) {
      this.showPopup('error', 'CCCD chưa hợp lệ', 'Số CCCD phải gồm đúng 12 chữ số.');
      return;
    }

    const payload: User = {
      ...this.user,
      phone: this.phoneDigits,
      passport: this.passportDigits,
      birthday: this.normalizeDateInput(this.user.birthday),
      passportExpiry: this.normalizeDateInput(this.user.passportExpiry)
    };

    const updateById = (id: string) => {
      this.userApi.update(id, payload).subscribe({
        next: (updatedUser) => {
          this.user = this.applyDisplayDateFields(updatedUser);
          this.isEditing = false;
          this.syncLocalUserStorage(this.user);
          this.showPopup('success', 'Lưu thành công', 'Thông tin cá nhân đã được cập nhật.');
        },
        error: (err) => {
          console.error('❌ Failed to update user:', err);
          this.showPopup('error', 'Lưu thất bại', err.error?.error || 'Vui lòng kiểm tra lại dữ liệu.');
        }
      });
    };

    if (this.user._id) {
      updateById(this.user._id);
      return;
    }

    this.userApi.getByEmail(this.user.email).subscribe({
      next: (dbUser) => {
        if (!dbUser?._id) {
          this.showPopup('error', 'Không tìm thấy tài khoản', 'Không thể cập nhật thông tin người dùng này.');
          return;
        }
        updateById(dbUser._id);
      },
      error: (err) => {
        console.error('❌ Failed to find user by email:', err);
        this.showPopup('error', 'Không thể lưu', 'Không tìm thấy tài khoản để lưu thông tin.');
      }
    });
  }

  closeSavePopup(): void {
    this.showSavePopup = false;
    if (this.popupTimer) {
      clearTimeout(this.popupTimer);
      this.popupTimer = null;
    }
  }

  private showPopup(type: 'success' | 'error', title: string, message: string): void {
    this.savePopupType = type;
    this.savePopupTitle = title;
    this.savePopupMessage = message;
    this.showSavePopup = true;

    if (this.popupTimer) {
      clearTimeout(this.popupTimer);
    }

    this.popupTimer = setTimeout(() => {
      this.showSavePopup = false;
      this.popupTimer = null;
    }, 2500);
  }

  private syncLocalUserStorage(updatedUser: User): void {
    localStorage.setItem('fullUserData', JSON.stringify(updatedUser));

    const currentUserJson = localStorage.getItem('currentUser');
    if (currentUserJson) {
      const currentUser = JSON.parse(currentUserJson);
      currentUser.name = updatedUser.fullName;
      currentUser.email = updatedUser.email;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    const usersJson = localStorage.getItem('users');
    if (!usersJson) return;

    const users = JSON.parse(usersJson);
    const index = users.findIndex((u: any) => u.email === updatedUser.email);
    if (index !== -1) {
      users[index] = {
        ...users[index],
        name: updatedUser.fullName,
        phone: updatedUser.phone,
        birthday: updatedUser.birthday,
        gender: updatedUser.gender,
        passport: updatedUser.passport,
        passportExpiry: updatedUser.passportExpiry,
        country: updatedUser.country,
        address: updatedUser.address,
        avatar: updatedUser.avatar
      };
      localStorage.setItem('users', JSON.stringify(users));
    }
  }

  private normalizeDateInput(value: any): string {
    if (!value) return '';
    const raw = String(value).trim();

    // ISO datetime => yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      return raw.slice(0, 10);
    }

    // Already ISO-like
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;

    // Convert dd/mm/yyyy => yyyy-mm-dd
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (dd && mm && yyyy && yyyy.length === 4) {
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }

    // Parse any Date-like string fallback
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return raw;
  }

  private formatDateOnlyForDisplay(value: any): string {
    if (!value) return '';
    const iso = this.normalizeDateInput(value);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value);

    const [yyyy, mm, dd] = iso.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  private applyDisplayDateFields(user: any): any {
    return {
      ...user,
      birthday: this.formatDateOnlyForDisplay(user?.birthday),
      passportExpiry: this.formatDateOnlyForDisplay(user?.passportExpiry)
    };
  }

  // Debug method - có thể gọi từ console hoặc thêm nút tạm
  reloadUserData(): void {
    console.log('🔄 Reloading user data from API...');
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      console.error('❌ No current user');
      alert('❌ Vui lòng đăng nhập lại!');
      return;
    }
    
    console.log('🔍 Looking for user:', currentUser.email);
    
    this.userApi.getByEmail(currentUser.email).subscribe({
      next: (foundUser) => {
        if (foundUser) {
          this.user = this.applyDisplayDateFields(foundUser);
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
          console.error('❌ User not found in API');
          alert(`❌ Không tìm thấy thông tin cho email: ${currentUser.email}\n\nCó thể bạn đã đăng ký tài khoản mới.`);
        }
      },
      error: (err) => {
        console.error('❌ Error loading user from API:', err);
        alert('❌ Lỗi khi tải dữ liệu từ API. Vui lòng kiểm tra console!');
      }
    });
  }
}