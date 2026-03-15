import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class AdminSidebarComponent {
  @Input() isOpen: boolean = false;
  
  menuItems = [
    { 
      route: '/admin-home', 
      icon: '/assets/icons/overview.png', 
      label: 'Tổng quan',
      active: true 
    },
    { 
      route: '/admin/ticket-management', 
      icon: '/assets/icons/ticket.png', 
      label: 'Quản lý vé và giao dịch',
      active: false 
    },
    { 
      route: '/admin/flight-management', 
      icon: '/assets/icons/flight.png', 
      label: 'Quản lý chuyến bay',
      active: false 
    },
    { 
      route: '/admin/airline-management', 
      icon: '/assets/icons/airline.png', 
      label: 'Quản lý hãng bay',
      active: false 
    },
    { 
      route: '/admin/promotion-management', 
      icon: '/assets/icons/promotion.png', 
      label: 'Khuyến mãi',
      active: false 
    },
    { 
      route: '/admin/user-management', 
      icon: '/assets/icons/customer.png', 
      label: 'Khách hàng',
      active: false 
    }
  ];

  setActive(index: number) {
    this.menuItems.forEach((item, i) => {
      item.active = i === index;
    });
  }
}
