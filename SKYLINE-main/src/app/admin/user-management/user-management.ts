import { Component, OnInit } from '@angular/core';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AdminHeader } from '../shared/header/admin-header/admin-header';

interface User {
  fullName: string;
  avatar: string;
  currentRank: string;
  points: number;
  nextRank: string;
  nextThreshold: number;
  email: string;
  password?: string;
  phone: string;
  birthday: string;
  gender: string;
  passport: string;
  passportExpiry: string;
  country: string;
  address: string;
  status?: string;
}

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

  // Trạng thái modal / confirm
  showDeleteConfirm = false;
  userToDeleteEmail: string | null = null;
  showViewModal = false;
  userToView: User | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.http.get<User[]>('assets/data/user_data.json').subscribe({
      next: (data) => (this.users = data),
      error: (err) => console.error('Lỗi đọc dữ liệu:', err),
    });
  }

  // Biểu mẫu mẫu
  emptyFormUser: User = {
    fullName: '',
    avatar: 'assets/img/AVT0.jpg',
    currentRank: 'Đồng',
    points: 0,
    nextRank: 'Bạc',
    nextThreshold: 500,
    email: '',
    password: '',
    phone: '',
    birthday: '',
    gender: 'Nam',
    passport: '',
    passportExpiry: '',
    country: 'Việt Nam',
    address: '',
    status: 'Hoạt động',
  };

  formUser: User = { ...this.emptyFormUser };

  // 🔹 Kiểm tra đang ở chế độ thêm hay sửa
  get isAddingMode(): boolean {
    return !this.users.some((u) => u.email === this.formUser.email);
  }

  // 🔹 Kiểm tra form có hợp lệ không
  get isFormInvalid(): boolean {
    const f = this.formUser;
    return !f.fullName.trim() || !f.email.trim() || !f.phone.trim() || !f.birthday.trim() || !f.address.trim();
  }

  // 🔹 Lọc danh sách
  get filteredUsers(): User[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.users
      .filter((u) => this.selectedRank === 'all' || u.currentRank === this.selectedRank)
      .filter((u) => this.selectedStatus === 'all' || (u.status || 'Hoạt động') === this.selectedStatus)
      .filter((u) => {
        if (!term) return true;
        const combined = `${u.fullName} ${u.email} ${u.phone} ${u.currentRank}`.toLowerCase();
        return combined.includes(term);
      });
  }

  get uniqueRanks(): string[] {
    return Array.from(new Set(this.users.map((u) => u.currentRank)));
  }

  get uniqueStatuses(): string[] {
    return Array.from(new Set(this.users.map((u) => u.status || 'Hoạt động')));
  }

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

  viewUser(user: User) {
    this.userToView = JSON.parse(JSON.stringify(user));
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.userToView = null;
  }

  editUser(user: User) {
    this.formUser = JSON.parse(JSON.stringify(user));
    this.activeTab = 'form';
  }

  promptDelete(email: string) {
    this.userToDeleteEmail = email;
    this.showDeleteConfirm = true;
  }

  confirmDelete() {
    if (this.userToDeleteEmail) {
      this.users = this.users.filter((u) => u.email !== this.userToDeleteEmail);
    }
    this.cancelDelete();
  }

  cancelDelete() {
    this.userToDeleteEmail = null;
    this.showDeleteConfirm = false;
  }

  isExistingUser(): boolean {
    return !!this.users.find((u) => u.email === this.formUser.email);
  }

  addUser() {
    if (this.users.find((u) => u.email === this.formUser.email)) {
      alert('Email đã tồn tại. Vui lòng sử dụng chức năng Chỉnh sửa.');
      return;
    }
    this.users.push({ ...this.formUser, avatar: this.formUser.avatar || 'assets/img/AVT0.jpg' });
    this.users.sort((a, b) => a.fullName.localeCompare(b.fullName));
    alert(`Đã thêm người dùng ${this.formUser.fullName} thành công!`);
    this.cancelForm();
  }

  updateUser() {
    const index = this.users.findIndex((u) => u.email === this.formUser.email);
    if (index !== -1) {
      this.users[index] = { ...this.formUser };
      alert('Cập nhật thông tin thành công!');
      this.cancelForm();
    } else {
      alert('Không tìm thấy người dùng để cập nhật!');
    }
  }

  cancelForm() {
    this.formUser = { ...this.emptyFormUser };
    this.activeTab = 'list';
  }
}
