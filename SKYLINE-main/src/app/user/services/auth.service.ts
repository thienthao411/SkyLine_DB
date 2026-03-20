import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { UserApiService } from '../../services/user-api.service';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  createdAt: string;
  // Thông tin bổ sung từ user_data.json
  phone?: string;
  birthday?: string;
  gender?: string;
  passport?: string;
  passportExpiry?: string;
  country?: string;
  address?: string;
  avatar?: string;
  currentRank?: string;
  points?: number;
  nextRank?: string;
  nextThreshold?: number;
  status?: string;
}

export interface UserWithoutPassword {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserWithoutPassword;
}

export interface AccountProvisionResult {
  status: 'existing' | 'created';
  user: UserWithoutPassword;
  tempPassword?: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
  expiresInMinutes?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  resetToken?: string;
  expiresInMinutes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private CURRENT_USER_KEY = 'currentUser';
  private USER_SESSION_KEY = 'userSession';

  constructor(
    private http: HttpClient,
    private userApiService: UserApiService
  ) {}

  // Đăng nhập qua API backend
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await lastValueFrom(
        this.userApiService.login(email, password)
      );

      if (response.success) {
        // Lưu token và user info
        localStorage.setItem('authToken', response.token);

        const userToStore: UserWithoutPassword = {
          id: response.user._id || Date.now(),
          name: response.user.fullName || response.user.name,
          email: response.user.email,
          createdAt: response.user.createdAt || new Date().toISOString()
        };

        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userToStore));
        localStorage.setItem('fullUserData', JSON.stringify(response.user));

        console.log('✅ Logged in successfully:', userToStore);

        return {
          success: true,
          message: response.message,
          user: userToStore
        };
      }

      return { success: false, message: response.message };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.error?.message || 'Lỗi khi đăng nhập!'
      };
    }
  }

  // Đăng ký qua API backend
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await lastValueFrom(
        this.userApiService.register({ fullName: name, email, password })
      );

      if (response.success) {
        // Lưu token và user info
        localStorage.setItem('authToken', response.token);

        const userToStore: UserWithoutPassword = {
          id: response.user._id || Date.now(),
          name: response.user.fullName || response.user.name,
          email: response.user.email,
          createdAt: response.user.createdAt || new Date().toISOString()
        };

        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(userToStore));
        localStorage.setItem('fullUserData', JSON.stringify(response.user));

        console.log('✅ New user registered with full data:', userToStore);

        return {
          success: true,
          message: response.message,
          user: userToStore
        };
      }

      return { success: false, message: response.message };
    } catch (error: any) {
      console.error('Register error:', error);
      return {
        success: false,
        message: error.error?.message || 'Lỗi khi đăng ký!'
      };
    }
  }

  logout(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
    localStorage.removeItem(this.USER_SESSION_KEY);
    localStorage.removeItem('fullUserData');
    localStorage.removeItem('authToken');
  }

  getCurrentUser(): UserWithoutPassword | null {
    // Kiểm tra session trước
    const session = localStorage.getItem(this.USER_SESSION_KEY);
    if (session) {
      const sessionData = JSON.parse(session);
      const now = new Date().getTime();
      
      // Kiểm tra session có còn hiệu lực
      if (now - sessionData.timestamp <= sessionData.expiresIn) {
        return sessionData.user;
      } else {
        // Session hết hạn, xóa dữ liệu
        this.logout();
        return null;
      }
    }
    
    // Fallback về cách cũ nếu không có session
    const user = localStorage.getItem(this.CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  validatePassword(password: string): boolean {
    return password.length >= 6;
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    try {
      const response = await lastValueFrom(this.userApiService.forgotPassword(email));
      return {
        success: !!response.success,
        message: response.message,
        expiresInMinutes: response.expiresInMinutes,
      };
    } catch (error: any) {
      if (error?.status === 0) {
        return {
          success: false,
          message: 'Khong ket noi duoc backend. Vui long kiem tra API dang chay o cong 5000.',
        };
      }

      return {
        success: false,
        message: error?.error?.message || 'Khong the gui yeu cau quen mat khau.',
      };
    }
  }

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    try {
      const response = await lastValueFrom(this.userApiService.verifyOtp(email, otp));
      return {
        success: !!response.success,
        message: response.message,
        resetToken: response.resetToken,
        expiresInMinutes: response.expiresInMinutes,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.error?.message || 'Xac nhan OTP that bai.',
      };
    }
  }

  async resetForgottenPassword(payload: {
    email: string;
    resetToken: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<ForgotPasswordResult> {
    try {
      const response = await lastValueFrom(this.userApiService.resetPassword(payload));
      return {
        success: !!response.success,
        message: response.message,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error?.error?.message || 'Dat lai mat khau that bai.',
      };
    }
  }

  async ensurePassengerAccount(name: string, email: string): Promise<AccountProvisionResult> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email hành khách không hợp lệ.');
    }

    let existingUser: any = null;
    try {
      existingUser = await lastValueFrom(this.userApiService.getByEmail(normalizedEmail));
    } catch (error: any) {
      // 404 means user does not exist yet, proceed to create account.
      if (error?.status !== 404) {
        throw error;
      }
    }

    if (existingUser) {
      return {
        status: 'existing',
        user: this.toUserWithoutPassword(existingUser),
      };
    }

    const tempPassword = this.generateTemporaryPassword();
    const response = await lastValueFrom(
      this.userApiService.register({
        fullName: String(name || '').trim() || 'Khach hang SKYLINE',
        email: normalizedEmail,
        password: tempPassword,
      })
    );

    if (!response?.success || !response?.user) {
      throw new Error(response?.message || 'Không thể tạo tài khoản hành khách.');
    }

    return {
      status: 'created',
      user: this.toUserWithoutPassword(response.user),
      tempPassword,
    };
  }

  private toUserWithoutPassword(user: any): UserWithoutPassword {
    return {
      id: user?._id || user?.id || Date.now(),
      name: user?.fullName || user?.name || 'Khach hang',
      email: user?.email || '',
      createdAt: user?.createdAt || new Date().toISOString(),
    };
  }

  private generateTemporaryPassword(): string {
    return `Sky${Math.random().toString(36).slice(2, 8)}!`;
  }
}
