import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements OnInit {
  userName: string = 'Tài khoản';
  isLoggedIn: boolean = false;
  showDropdown: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Get current user name
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userName = currentUser.name;
      this.isLoggedIn = true;
    }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
    console.log('Dropdown state:', this.showDropdown);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event): void {
    const target = event.target as HTMLElement;
    const userMenu = target.closest('.user-menu');
    
    // Chỉ đóng nếu click outside và dropdown đang mở
    if (!userMenu && this.showDropdown) {
      this.showDropdown = false;
      console.log('Dropdown closed');
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.showDropdown) {
      this.showDropdown = false;
    }
  }

  logout(): void {
    this.authService.logout();
    localStorage.removeItem('fullUserData');
    this.isLoggedIn = false;
    this.userName = 'Tài khoản';
    this.showDropdown = false;
    this.router.navigate(['/customer-sign-in']);
  }

  navigateToInformation(event: MouseEvent): void {
    event.stopPropagation();
    this.showDropdown = false;
    this.router.navigate(['/information']);
  }
  
}
