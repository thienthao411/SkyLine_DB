import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { AdminNotificationItem } from '../services/admin-notification.service';
import {
  JobApplicationModel,
  RecruitmentActivityModel,
  RecruitmentApiService,
  RecruitmentJobModel
} from '../../services/recruitment-api.service';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-recruitment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './recruitment-management.html',
  styleUrl: './recruitment-management.css'
})
export class RecruitmentManagementComponent implements OnInit, OnDestroy {
  readonly applicationStatusOptions: Array<{ value: 'all' | JobApplicationModel['status']; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'new', label: 'Mới nhận' },
    { value: 'reviewing', label: 'Đang xem' },
    { value: 'shortlisted', label: 'Đạt sơ tuyển' },
    { value: 'rejected', label: 'Không phù hợp' }
  ];

  activeTab: 'jobs' | 'applications' | 'activities' = 'jobs';
  sidebarOpen = true;

  jobs: RecruitmentJobModel[] = [];
  applications: JobApplicationModel[] = [];
  activities: RecruitmentActivityModel[] = [];
  selectedJobId = '';
  isLoadingJobs = false;
  isLoadingApplications = false;
  isLoadingActivities = false;
  showRealtimeAlert = false;
  realtimeAlertMessage = '';
  highlightedApplicationId = '';
  applicationStatusFilter: 'all' | JobApplicationModel['status'] = 'all';

  editingJobId: string | null = null;
  jobForm: RecruitmentJobModel = this.emptyJobForm();

  private pendingApplicationFromNotification = '';
  private removeAdminRealtimeListener: (() => void) | null = null;
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  readonly teamOptions = [
    'Product Engineering',
    'Platform Engineering',
    'Customer Experience',
    'Marketing',
    'Operations'
  ];

  readonly locationOptions = [
    'Thủ Đức, TP.HCM',
    'Quận 1, TP.HCM',
    'Hybrid',
    'Remote'
  ];

  readonly typeOptions = ['Toàn thời gian', 'Bán thời gian', 'Theo ca', 'Thực tập'];

  readonly levelOptions = [
    'Intern',
    'Fresher',
    'Junior',
    'Junior - Middle',
    'Middle',
    'Senior',
    'Lead'
  ];

  readonly salaryRangeOptions = [
    'Thỏa thuận',
    '8 - 12 triệu',
    '12 - 18 triệu',
    '15 - 24 triệu',
    '18 - 28 triệu',
    '25 - 35 triệu',
    'Trên 35 triệu'
  ];

  constructor(
    private recruitmentApi: RecruitmentApiService,
    private route: ActivatedRoute,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    this.applyRouteQueryParams();
    this.loadJobs();
    this.loadApplications();
    this.loadActivities();

    this.realtimeService.joinAdminRoom();
    this.removeAdminRealtimeListener = this.realtimeService.on<AdminNotificationItem>('admin_notification_created', (payload) => {
      if (payload.type !== 'recruitment_application') {
        return;
      }

      this.realtimeAlertMessage = payload.message || 'Có hồ sơ ứng tuyển mới vừa được gửi.';
      this.showRealtimeAlert = true;
      this.clearAlertTimer();
      this.alertTimer = setTimeout(() => {
        this.showRealtimeAlert = false;
      }, 6000);

      this.loadApplications();
      this.loadActivities();
    });
  }

  ngOnDestroy(): void {
    if (this.removeAdminRealtimeListener) {
      this.removeAdminRealtimeListener();
      this.removeAdminRealtimeListener = null;
    }
    this.clearAlertTimer();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  switchTab(tab: 'jobs' | 'applications' | 'activities'): void {
    this.activeTab = tab;

    if (tab === 'applications') {
      this.focusApplicationFromNotification();
    }
  }

  setApplicationStatusFilter(status: 'all' | JobApplicationModel['status']): void {
    this.applicationStatusFilter = status;
  }

  loadJobs(): void {
    this.isLoadingJobs = true;
    this.recruitmentApi.getJobs(true).subscribe({
      next: (jobs) => {
        this.jobs = jobs || [];
        this.isLoadingJobs = false;
      },
      error: (error) => {
        console.error('Lỗi tải vị trí tuyển dụng:', error);
        this.jobs = [];
        this.isLoadingJobs = false;
      }
    });
  }

  loadApplications(): void {
    this.isLoadingApplications = true;
    this.recruitmentApi.getApplications().subscribe({
      next: (applications) => {
        this.applications = applications || [];
        this.isLoadingApplications = false;
        this.focusApplicationFromNotification();
      },
      error: (error) => {
        console.error('Lỗi tải hồ sơ ứng tuyển:', error);
        this.applications = [];
        this.isLoadingApplications = false;
      }
    });
  }

  loadActivities(): void {
    this.isLoadingActivities = true;
    this.recruitmentApi.getActivities().subscribe({
      next: (activities) => {
        this.activities = activities || [];
        this.isLoadingActivities = false;
      },
      error: (error) => {
        console.error('Lỗi tải nhật ký tuyển dụng:', error);
        this.activities = [];
        this.isLoadingActivities = false;
      }
    });
  }

  saveJob(): void {
    const payload: RecruitmentJobModel = {
      ...this.jobForm,
      title: this.jobForm.title.trim(),
      team: this.jobForm.team.trim(),
      location: this.jobForm.location.trim(),
      type: this.jobForm.type.trim(),
      level: this.jobForm.level.trim(),
      salaryRange: this.jobForm.salaryRange.trim(),
      summary: this.jobForm.summary.trim(),
      skills: this.normalizeSkills(this.jobForm.skills)
    };

    if (!payload.title) return;

    if (this.editingJobId) {
      this.recruitmentApi.updateJob(this.editingJobId, payload).subscribe({
        next: () => {
          this.loadJobs();
          this.loadActivities();
          this.resetJobForm();
        },
        error: (error) => console.error('Lỗi cập nhật vị trí:', error)
      });
      return;
    }

    this.recruitmentApi.createJob(payload).subscribe({
      next: () => {
        this.loadJobs();
        this.loadActivities();
        this.resetJobForm();
      },
      error: (error) => console.error('Lỗi tạo vị trí:', error)
    });
  }

  editJob(job: RecruitmentJobModel): void {
    this.editingJobId = job._id || null;
    this.jobForm = {
      title: job.title,
      team: job.team,
      location: job.location,
      type: job.type,
      level: job.level,
      salaryRange: job.salaryRange || 'Thỏa thuận',
      summary: job.summary,
      skills: [...(job.skills || [])],
      status: job.status
    };
  }

  deleteJob(job: RecruitmentJobModel): void {
    if (!job._id) return;
    if (!confirm(`Xóa vị trí "${job.title}"?`)) return;

    this.recruitmentApi.deleteJob(job._id).subscribe({
      next: () => {
        this.loadJobs();
        this.loadActivities();
      },
      error: (error) => console.error('Lỗi xóa vị trí:', error)
    });
  }

  updateApplicationStatus(application: JobApplicationModel, status: JobApplicationModel['status']): void {
    if (!application._id) return;

    this.recruitmentApi.updateApplicationStatus(application._id, status).subscribe({
      next: () => {
        this.loadApplications();
        this.loadActivities();
      },
      error: (error) => console.error('Lỗi cập nhật trạng thái hồ sơ:', error)
    });
  }

  resolveActionText(action: RecruitmentActivityModel['action']): string {
    const map: Record<string, string> = {
      job_created: 'Tạo vị trí tuyển dụng',
      job_updated: 'Cập nhật vị trí tuyển dụng',
      job_deleted: 'Xóa vị trí tuyển dụng',
      application_submitted: 'Ứng viên nộp hồ sơ',
      application_status_updated: 'Cập nhật trạng thái hồ sơ'
    };

    return map[action || ''] || action || 'Không xác định';
  }

  resolveApplicationStatusLabel(status: JobApplicationModel['status']): string {
    const map: Record<JobApplicationModel['status'], string> = {
      new: 'Mới nhận',
      reviewing: 'Đang xem',
      shortlisted: 'Đạt sơ tuyển',
      rejected: 'Không phù hợp'
    };

    return map[status] || status;
  }

  resolveApplicationStatusClass(status: string | undefined): string {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'shortlisted') return 'status-shortlisted';
    if (normalized === 'rejected') return 'status-closed';
    return 'status-open';
  }

  resolveStatusTransitionText(previousStatus?: string, nextStatus?: string): string {
    const previous = String(previousStatus || '').trim().toLowerCase();
    const next = String(nextStatus || '').trim().toLowerCase();

    if (!previous && !next) {
      return '-';
    }

    if (!previous) {
      return this.resolveApplicationStatusLabel(next as JobApplicationModel['status']);
    }

    if (!next) {
      return this.resolveApplicationStatusLabel(previous as JobApplicationModel['status']);
    }

    return `${
      this.resolveApplicationStatusLabel(previous as JobApplicationModel['status'])
    } -> ${
      this.resolveApplicationStatusLabel(next as JobApplicationModel['status'])
    }`;
  }

  getActivityJobTitle(activity: RecruitmentActivityModel): string {
    if (activity.jobId && typeof activity.jobId === 'object') {
      return activity.jobId.title || 'Đang cập nhật';
    }

    return 'Đang cập nhật';
  }

  getSkillText(job: RecruitmentJobModel): string {
    return (job.skills || []).join(', ');
  }

  getJobDisplayTitle(application: JobApplicationModel): string {
    const job = application.jobId;
    if (typeof job === 'string') {
      return this.jobs.find((item) => item._id === job)?.title || 'Không xác định';
    }

    return job?.title || 'Không xác định';
  }

  getJobFormSkillsText(): string {
    return (this.jobForm.skills || []).join(', ');
  }

  setJobFormSkills(value: string): void {
    this.jobForm.skills = this.normalizeSkills(value);
  }

  resetJobForm(): void {
    this.editingJobId = null;
    this.jobForm = this.emptyJobForm();
  }

  dismissRealtimeAlert(): void {
    this.showRealtimeAlert = false;
    this.clearAlertTimer();
  }

  getFilteredApplications(): JobApplicationModel[] {
    if (this.applicationStatusFilter === 'all') {
      return this.applications;
    }

    return this.applications.filter((item) => item.status === this.applicationStatusFilter);
  }

  getApplicationCountByStatus(status: 'all' | JobApplicationModel['status']): number {
    if (status === 'all') {
      return this.applications.length;
    }

    return this.applications.filter((item) => item.status === status).length;
  }

  trackByApplicationId(_index: number, item: JobApplicationModel): string {
    return item._id || item.email;
  }

  private applyRouteQueryParams(): void {
    const tab = String(this.route.snapshot.queryParamMap.get('tab') || '').trim().toLowerCase();
    const applicationId = String(this.route.snapshot.queryParamMap.get('applicationId') || '').trim();

    if (tab === 'applications' || tab === 'jobs' || tab === 'activities') {
      this.activeTab = tab;
    }

    if (applicationId) {
      this.pendingApplicationFromNotification = applicationId;
      this.highlightedApplicationId = applicationId;
      this.activeTab = 'applications';
    }
  }

  private focusApplicationFromNotification(): void {
    const applicationId = this.pendingApplicationFromNotification;
    if (!applicationId || this.activeTab !== 'applications') {
      return;
    }

    const exists = this.applications.some((item) => item._id === applicationId);
    if (!exists) {
      return;
    }

    setTimeout(() => {
      const row = document.getElementById(`application-${applicationId}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    this.pendingApplicationFromNotification = '';
  }

  private clearAlertTimer(): void {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
  }

  private normalizeSkills(value: string[] | string): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    return String(value || '')
      .split(/[,\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private emptyJobForm(): RecruitmentJobModel {
    return {
      title: '',
      team: '',
      location: '',
      type: 'Toàn thời gian',
      level: 'Junior',
      salaryRange: 'Thỏa thuận',
      summary: '',
      skills: [],
      status: 'open'
    };
  }
}
