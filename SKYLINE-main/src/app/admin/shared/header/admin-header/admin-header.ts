import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-header', // Tag <app-admin-header>
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.css']
})
export class AdminHeader implements OnInit {

  // Nhận thông tin user từ component cha (AdminHome)
  @Input() currentUser: any = null;
  
  // Gửi sự kiện "click" ra cho cha để cha xử lý việc đóng/mở sidebar
  @Output() toggleSidebarClicked = new EventEmitter<void>();

  // Trạng thái riêng của header:
  showUserDropdown: boolean = false;

  constructor(private router: Router) { }

  ngOnInit() {
  }

  // Xử lý đăng xuất
  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/admin-login']);
  }

  // Phát sự kiện ra cho cha
  onToggleSidebar() {
    this.toggleSidebarClicked.emit();
  }

  // Đóng/mở dropdown user
  toggleUserDropdown(event: Event) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra document
    this.showUserDropdown = !this.showUserDropdown;
  }

  // Đóng dropdown user khi click ra ngoài
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Chỉ đóng nếu dropdown đang mở
    if (this.showUserDropdown) {
      this.showUserDropdown = false;
    }
  }
}