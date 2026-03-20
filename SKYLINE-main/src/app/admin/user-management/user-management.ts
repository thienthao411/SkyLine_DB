import { Component, OnInit } from '@angular/core';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { UserApiService, User } from '../../services/user-api.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [AdminSidebarComponent, AdminHeader, CommonModule, FormsModule, HttpClientModule],
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css'],
})
export class UserManagement implements OnInit {
  readonly fallbackAvatar = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  showSuccessPopup = false;
  successPopupMessage = '';
  private successPopupTimer: ReturnType<typeof setTimeout> | null = null;

  activeTab: string = 'list';
  searchTerm: string = '';
  selectedRank: string = 'all';
  selectedStatus: string = 'all';
  users: User[] = [];
  currentPasswordDisplay: string = '';
  showCurrentPassword: boolean = false;

  // modal
  showDeleteConfirm = false;
  userToDeleteEmail: string | null = null;
  showViewModal = false;
  userToView: User | null = null;

  constructor(private userApi: UserApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // ================= LOAD =================
  loadUsers() {
    this.userApi.getAll().subscribe({
      next: (data) => {
        this.users = data;
        this.currentPage = 1;
      },
      error: (err) => {
        console.error(err);
        alert('Không load được dữ liệu!');
      }
    });
  }

  // ================= FORM =================
  emptyFormUser: User = {
    fullName: '',
    avatar: this.fallbackAvatar,
    currentRank: 'Bạc',
    points: 0,
    nextRank: 'Bạc',
    nextThreshold: 500,
    email: '',
    password: '', // 🔥 QUAN TRỌNG
    phone: '',
    birthday: '',
    gender: 'Nam',
    passport: '',
    passportExpiry: '',
    country: 'Việt Nam',
    address: '',
    status: 'active',
  };

  formUser: User = { ...this.emptyFormUser };

  // ================= VALIDATE =================
  get isAddingMode(): boolean {
    return !this.users.some(u => u.email === this.formUser.email);
  }

  get isFormInvalid(): boolean {
    const f = this.formUser;
    return !f.fullName?.trim()
      || !f.email?.trim()
      || !f.password?.trim() // 🔥 FIX
      || !f.phone?.trim()
      || !f.birthday?.trim()
      || !f.address?.trim();
  }

  get isCreateFormInvalid(): boolean {
    const f = this.formUser;
    return !f.fullName?.trim()
      || !f.email?.trim()
      || !f.password?.trim()
      || !f.phone?.trim()
      || !f.birthday?.trim()
      || !f.address?.trim();
  }

  get isUpdateFormInvalid(): boolean {
    const f = this.formUser;
    return !f.fullName?.trim() || !f.email?.trim();
  }

  // ================= FILTER =================
  get filteredUsers(): User[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users
      .filter(u => this.selectedRank === 'all' || u.currentRank === this.selectedRank)
      .filter(u => this.selectedStatus === 'all' || u.status === this.selectedStatus)
      .filter(u => {
        if (!term) return true;
        const text = `${u.fullName} ${u.email} ${u.phone} ${u.currentRank}`.toLowerCase();
        return text.includes(term);
      });
  }

  get uniqueRanks(): string[] {
    return Array.from(
      new Set(this.users.map(u => u.currentRank).filter(rank => !!rank && rank !== 'Đồng'))
    );
  }

  get formRankOptions(): string[] {
    const ranks = new Set(
      this.users
        .map(u => u.currentRank)
        .filter((rank): rank is string => !!rank && rank !== 'Đồng')
    );

    if (this.formUser.currentRank && this.formUser.currentRank !== 'Đồng') {
      ranks.add(this.formUser.currentRank);
    }

    if (ranks.size === 0) {
      ranks.add(this.emptyFormUser.currentRank);
    }

    return Array.from(ranks);
  }

  get uniqueStatuses(): string[] {
  return Array.from(
    new Set(
      this.users
        .map(u => u.status)
        .filter(Boolean) // bỏ undefined/null
    )
  ) as string[];
}

  // ================= PAGINATION =================
currentPage: number = 1;
pageSize: number = 10;

get paginatedUsers(): User[] {
  if (this.currentPage > this.totalPages) {
    this.currentPage = this.totalPages;
  }
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredUsers.slice(start, start + this.pageSize);
}

get totalPages(): number {
  return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
}

onFilterChange() {
  this.currentPage = 1;
}

nextPage() {
  if (this.currentPage < this.totalPages) this.currentPage++;
}

prevPage() {
  if (this.currentPage > 1) this.currentPage--;
}

  // ================= TAB =================
  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'form') {
      this.formUser = { ...this.emptyFormUser };
      this.currentPasswordDisplay = '';
      this.showCurrentPassword = false;
    }
  }

  navigateToAddForm() {
    this.formUser = { ...this.emptyFormUser };
    this.currentPasswordDisplay = '';
    this.showCurrentPassword = false;
    this.activeTab = 'form';
  }

  // ================= VIEW =================
  viewUser(user: User) {
    this.userToView = JSON.parse(JSON.stringify(user));
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.userToView = null;
  }

  // ================= EDIT =================
  editUser(user: User) {
    this.formUser = JSON.parse(JSON.stringify(user));
    this.formUser.password = '';
    this.formUser.birthday = this.toDateInput(this.formUser.birthday);
    this.formUser.passportExpiry = this.toDateInput(this.formUser.passportExpiry);
    this.currentPasswordDisplay = 'Đang tải...';
    this.showCurrentPassword = false;

    this.userApi.getByEmail(user.email).subscribe({
      next: (detail) => {
        const value = String(detail?.password || '').trim();
        this.currentPasswordDisplay = value || '(Chưa thiết lập)';
      },
      error: (err) => {
        console.error(err);
        this.currentPasswordDisplay = '(Không tải được)';
      }
    });

    this.activeTab = 'form';
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn đúng file ảnh.');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 2MB.');
      input.value = '';
      return;
    }

    try {
      const compressed = await this.compressAvatarImage(file);
      this.formUser.avatar = compressed;
    } catch (error) {
      console.error(error);
      alert('Không thể xử lý ảnh. Vui lòng thử ảnh khác.');
      input.value = '';
    }
  }

  // ================= ADD =================
  addUser() {
    if (this.users.find(u => u.email === this.formUser.email)) {
      alert('Email đã tồn tại!');
      return;
    }

    const payload = this.buildUserPayload(this.formUser);

    this.userApi.create(payload).subscribe({
      next: (created) => {
        this.users.push(created);
        alert(`Thêm ${created.fullName} thành công!`);
        this.cancelForm();
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.error || 'Thêm user thất bại!');
      }
    });
  }

  // ================= UPDATE =================
  updateUser() {
    const existing = this.users.find(u => u.email === this.formUser.email);

    if (!existing || !existing._id) {
      alert('Không tìm thấy user!');
      return;
    }

    const payload = this.buildUserPayload(this.formUser);

    this.userApi.update(existing._id, payload).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u._id === updated._id);
        if (idx !== -1) this.users[idx] = updated;

        this.openSuccessPopup('Chỉnh sửa người dùng thành công!');
        this.cancelForm();
      },
      error: (err) => {
        console.error(err);
        const message = err?.error?.error || err?.error?.message || 'Cập nhật thất bại!';
        alert(message);
      }
    });
  }

  private openSuccessPopup(message: string): void {
    this.successPopupMessage = message;
    this.showSuccessPopup = true;

    if (this.successPopupTimer) {
      clearTimeout(this.successPopupTimer);
    }

    this.successPopupTimer = setTimeout(() => {
      this.showSuccessPopup = false;
      this.successPopupTimer = null;
    }, 2200);
  }

  // ================= DELETE =================
  promptDelete(email: string) {
    this.userToDeleteEmail = email;
    this.showDeleteConfirm = true;
  }

  confirmDelete() {
    const user = this.users.find(u => u.email === this.userToDeleteEmail);
    if (!user || !user._id) return;

    this.userApi.delete(user._id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u._id !== user._id);
        this.cancelDelete();
      },
      error: (err) => {
        console.error(err);
        alert('Xóa thất bại!');
      }
    });
  }

  cancelDelete() {
    this.userToDeleteEmail = null;
    this.showDeleteConfirm = false;
  }

  // ================= RESET =================
  cancelForm() {
    this.formUser = { ...this.emptyFormUser };
    this.currentPasswordDisplay = '';
    this.showCurrentPassword = false;
    this.activeTab = 'list';
  }

  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  formatDisplayDate(value: any): string {
    const iso = this.toDateInput(value);
    if (!iso) return '';

    const parts = iso.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${dd}/${mm}/${yyyy}`;
    }

    return String(value || '');
  }

  private toDateInput(value: any): string {
    if (!value) return '';
    const raw = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('/');
      return `${yyyy}-${mm}-${dd}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return '';
  }

  private toNullableDateInput(value: any): string | null {
    const date = this.toDateInput(value);
    return date || null;
  }

  private buildUserPayload(source: User): User {
    const payload: User = {
      ...source,
      birthday: this.toNullableDateInput(source.birthday) as any,
      passportExpiry: this.toNullableDateInput(source.passportExpiry) as any,
    };

    if (payload._id) {
      delete payload._id;
    }

    if (!payload.password || !String(payload.password).trim()) {
      delete payload.password;
    }

    return payload;
  }

  private compressAvatarImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Invalid file reader result'));
          return;
        }

        const image = new Image();
        image.onload = () => {
          const maxSide = 720;
          const ratio = Math.min(maxSide / image.width, maxSide / image.height, 1);
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

          // Keep payload under ~1.5MB (base64 string length).
          if (dataUrl.length > 1_500_000) {
            reject(new Error('Image payload too large after compression'));
            return;
          }

          resolve(dataUrl);
        };

        image.onerror = () => reject(new Error('Image load failed'));
        image.src = result;
      };

      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  getRankLabel(rank: string | undefined | null): string {
    const value = String(rank || '').trim();
    if (!value) return '';

    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (normalized === 'bronze' || normalized === 'dong') return 'Hạng Đồng';
    if (normalized === 'silver' || normalized === 'bac') return 'Hạng Bạc';
    if (normalized === 'gold' || normalized === 'vang') return 'Hạng Vàng';
    if (normalized === 'platinum' || normalized === 'bachkim') return 'Hạng Bạch Kim';

    return value;
  }
}