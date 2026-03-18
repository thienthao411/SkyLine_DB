import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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

  ngOnInit(): void {
    const fullUser = localStorage.getItem('fullUserData');
    if (fullUser) {
      this.user = JSON.parse(fullUser);
    } else {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        this.user = JSON.parse(currentUser);
      }
    }
  }  
}