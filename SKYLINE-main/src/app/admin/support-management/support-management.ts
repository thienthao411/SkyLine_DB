import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import {
  AdminNotificationItem,
  AdminNotificationService,
  SupportRequestStatus
} from '../services/admin-notification.service';

@Component({
  selector: 'app-support-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './support-management.html',
  styleUrl: './support-management.css'
})
export class SupportManagementComponent implements OnInit {
  sidebarOpen = true;
  requests: AdminNotificationItem[] = [];
  isLoading = false;
  isSaving = false;
  statusFilter: 'all' | SupportRequestStatus = 'all';
  highlightedRequestId = '';
  toastVisible = false;
  toastType: 'success' | 'error' = 'success';
  toastMessage = '';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly statusOptions: Array<{ value: 'all' | SupportRequestStatus; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'new', label: 'Chưa xử lý' },
    { value: 'in_progress', label: 'Đang xử lý' },
    { value: 'resolved', label: 'Đã xử lý' }
  ];

  statusDraftById: Record<string, SupportRequestStatus> = {};
  noteDraftById: Record<string, string> = {};

  constructor(
    private adminNotificationService: AdminNotificationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.highlightedRequestId = String(params['requestId'] || '').trim();
    });

    this.loadRequests();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setStatusFilter(value: 'all' | SupportRequestStatus): void {
    this.statusFilter = value;
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;

    this.adminNotificationService.getSupportRequests(this.statusFilter).subscribe({
      next: (requests) => {
        this.requests = requests;
        this.syncDrafts(requests);
        this.isLoading = false;

        if (this.highlightedRequestId) {
          this.focusHighlightedRequest();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.showToast('error', error?.error?.message || 'Không thể tải danh sách yêu cầu hỗ trợ.');
      }
    });
  }

  private syncDrafts(requests: AdminNotificationItem[]): void {
    this.statusDraftById = {};
    this.noteDraftById = {};

    requests.forEach((item) => {
      const status = item.supportRequest?.status;
      this.statusDraftById[item._id] = status === 'in_progress' || status === 'resolved' ? status : 'new';
      this.noteDraftById[item._id] = String(item.supportRequest?.adminNote || '');
    });
  }

  saveRequest(item: AdminNotificationItem): void {
    const id = item._id;
    const status = this.statusDraftById[id] || 'new';
    const adminNote = String(this.noteDraftById[id] || '').trim();

    this.isSaving = true;

    this.adminNotificationService.updateSupportRequestStatus(id, { status, adminNote }).subscribe({
      next: (updated) => {
        this.requests = this.requests.map((entry) => (entry._id === updated._id ? updated : entry));
        this.syncDrafts(this.requests);
        this.isSaving = false;
        this.showToast('success', 'Đã cập nhật trạng thái yêu cầu hỗ trợ.');
      },
      error: (error) => {
        this.isSaving = false;
        this.showToast('error', error?.error?.message || 'Không thể cập nhật yêu cầu hỗ trợ.');
      }
    });
  }

  statusLabel(value: string | undefined): string {
    if (value === 'in_progress') return 'Đang xử lý';
    if (value === 'resolved') return 'Đã xử lý';
    return 'Chưa xử lý';
  }

  displayTopic(value: string | undefined): string {
    const raw = String(value || '').trim();
    if (!raw) return '--';

    const normalized = raw.toLowerCase();
    if (normalized === 'gop y va phan hoi') return 'Góp ý & Phản hồi';
    if (normalized === 'ho tro thanh toan') return 'Hỗ trợ thanh toán';
    if (normalized === 'van de khuyen mai') return 'Vấn đề khuyến mãi';
    if (normalized === 'khac') return 'Khác';

    return raw;
  }

  statusClass(value: string | undefined): string {
    if (value === 'in_progress') return 'status-pill--in-progress';
    if (value === 'resolved') return 'status-pill--resolved';
    return 'status-pill--new';
  }

  formattedTime(value: string | undefined): string {
    if (!value) return '--';
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) return '--';
    return time.toLocaleString('vi-VN');
  }

  hideToast(): void {
    this.toastVisible = false;
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toastType = type;
    this.toastMessage = message;
    this.toastVisible = true;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.toastTimer = null;
    }, 2800);
  }

  private focusHighlightedRequest(): void {
    const targetId = this.highlightedRequestId;
    if (!targetId) return;

    const exists = this.requests.some((item) => item._id === targetId);
    if (!exists) return;

    setTimeout(() => {
      const element = document.getElementById(`support-${targetId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }
}
