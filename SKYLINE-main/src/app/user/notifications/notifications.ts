import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  user = {
    fullName: 'Trần Thiên Thảo',
    avatar: 'assets/img/AVT.jpg'
  };

  notifications = [
    { name: 'Thông báo ưu đãi và khuyến mãi', enabled: true },
    { name: 'Thông báo chuyến bay', enabled: false },
    { name: 'Tin nhắn hỗ trợ', enabled: true }
  ];
}
