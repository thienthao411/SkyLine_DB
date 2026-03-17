import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationEntry, NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications implements OnInit {
  user = {
    fullName: 'Trần Thiên Thảo',
    avatar: 'assets/img/AVT.jpg'
  };

  inbox: NotificationEntry[] = [];
  notifications = [
    { name: 'Thông báo ưu đãi và khuyến mãi', enabled: true },
    { name: 'Thông báo chuyến bay', enabled: false },
    { name: 'Tin nhắn hỗ trợ', enabled: true }
  ];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.inbox = this.notificationService.getNotifications();
    this.notificationService.markAllAsRead();
  }
}
