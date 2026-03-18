import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UserApiService } from '../../services/user-api.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  readonly fallbackAvatar = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  user: any = {
    fullName: 'Khách chưa đăng nhập',
    avatar: this.fallbackAvatar
  };

  constructor(private userApi: UserApiService) {}

  ngOnInit(): void {
    const fullUser = localStorage.getItem('fullUserData');
    if (fullUser) {
      this.user = { ...this.user, ...JSON.parse(fullUser) };
    } else {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        this.user = { ...this.user, ...JSON.parse(currentUser) };
      }
    }

    if (!this.user.avatar) {
      this.user.avatar = this.fallbackAvatar;
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh hợp lệ.');
      input.value = '';
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 3MB.');
      input.value = '';
      return;
    }

    try {
      const dataUrl = await this.fileToDataUrl(file);
      this.user = { ...this.user, avatar: dataUrl };
      this.persistUserLocally();
      this.syncAvatarToServer();
    } catch (error) {
      console.error('Avatar update error:', error);
      alert('Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
    } finally {
      input.value = '';
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Invalid reader result'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  private persistUserLocally(): void {
    const fullUser = localStorage.getItem('fullUserData');
    if (fullUser) {
      const merged = { ...JSON.parse(fullUser), avatar: this.user.avatar };
      localStorage.setItem('fullUserData', JSON.stringify(merged));
    }

    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const merged = { ...JSON.parse(currentUser), avatar: this.user.avatar };
      localStorage.setItem('currentUser', JSON.stringify(merged));
    }
  }

  private syncAvatarToServer(): void {
    if (!this.user?._id) return;

    this.userApi.update(this.user._id, this.user).subscribe({
      error: (error) => {
        console.warn('Không đồng bộ được avatar lên server:', error);
      }
    });
  }
}