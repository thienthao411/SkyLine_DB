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

  activeTab: string = 'list';
  searchTerm: string = '';
  selectedRank: string = 'all';
  selectedStatus: string = 'all';
  users: User[] = [];

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
    avatar: 'assets/img/AVT0.jpg',
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
    }
  }

  navigateToAddForm() {
    this.formUser = { ...this.emptyFormUser };
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
    this.formUser.birthday = this.toDateInput(this.formUser.birthday);
    this.formUser.passportExpiry = this.toDateInput(this.formUser.passportExpiry);
    this.activeTab = 'form';
  }

  // ================= ADD =================
  addUser() {
    if (this.users.find(u => u.email === this.formUser.email)) {
      alert('Email đã tồn tại!');
      return;
    }

    const payload: User = {
      ...this.formUser,
      birthday: this.toDateInput(this.formUser.birthday),
      passportExpiry: this.toDateInput(this.formUser.passportExpiry)
    };

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

    const payload: User = {
      ...this.formUser,
      birthday: this.toDateInput(this.formUser.birthday),
      passportExpiry: this.toDateInput(this.formUser.passportExpiry)
    };

    this.userApi.update(existing._id, payload).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u._id === updated._id);
        if (idx !== -1) this.users[idx] = updated;

        alert('Cập nhật thành công!');
        this.cancelForm();
      },
      error: (err) => {
        console.error(err);
        alert('Cập nhật thất bại!');
      }
    });
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
    this.activeTab = 'list';
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
}