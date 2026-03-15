# Admin Sidebar Component

Component sidebar dùng chung cho tất cả các trang admin.

## Cách sử dụng

### 1. Import component trong TypeScript:

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';

@Component({
  selector: 'app-your-component',
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './your-component.html',
  styleUrl: './your-component.css',
})
export class YourComponent {
  // Your code here
}
```

### 2. Sử dụng trong HTML:

```html
<div class="admin-container">
  <!-- Sidebar Component -->
  <app-admin-sidebar></app-admin-sidebar>

  <!-- Main Content -->
  <main class="main-content">
    <!-- Your content here -->
  </main>
</div>
```

### 3. Thêm CSS cơ bản:

```css
.admin-container {
  display: flex;
  height: 100vh;
  background-color: #f5f7fa;
  font-family: 'Roboto', Tahoma, Geneva, Verdana, sans-serif;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  margin-left: 250px;
  background-color: #375578;
}
```

## Menu Items

Sidebar hiện tại có 8 menu items:
1. Tổng quan (`/admin-home`)
2. Quản lý vé và giao dịch (`/admin/ticket-management`)
3. Quản lý chuyến bay (`/admin/flight-management`)
4. Quản lý hãng bay (`/admin/airline-management`)
5. Ghế ngồi (`/admin/seat-management`)
6. Khuyến mãi (`/admin/promotion-management`)
7. Khách hàng (`/admin/user-management`)
8. Cài đặt hệ thống (`/admin/settings`)

## Features

- ✅ Responsive design (mobile-friendly)
- ✅ Active state với RouterLinkActive
- ✅ Icon color filter khi active
- ✅ Smooth transitions
- ✅ Fixed position sidebar

## Tùy chỉnh menu

Để thay đổi menu items, chỉnh sửa trong `sidebar.ts`:

```typescript
menuItems = [
  { 
    route: '/admin-home', 
    icon: '/assets/icons/overview.png', 
    label: 'Tổng quan',
    active: true 
  },
  // Add more items...
];
```
