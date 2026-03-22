import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { RecruitmentApiService, RecruitmentJobModel } from '../../services/recruitment-api.service';

interface JobOpening {
  id: string;
  title: string;
  team: string;
  location: string;
  type: string;
  level: string;
  salaryRange: string;
  summary: string;
  skills: string[];
}

interface BenefitItem {
  title: string;
  detail: string;
}

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, FooterComponent],
  templateUrl: './recruitment.html',
  styleUrl: './recruitment.css',
})
export class RecruitmentComponent implements OnInit {
  jobs: JobOpening[] = [];
  isLoadingJobs = false;
  isSubmitting = false;
  selectedCvFile: File | null = null;
  selectedCvFileName = '';

  form = {
    jobId: '',
    fullName: '',
    email: '',
    phone: '',
    coverLetter: ''
  };

  formMessage = '';
  formMessageType: 'success' | 'error' = 'error';

  readonly benefits: BenefitItem[] = [
    {
      title: 'Mức thu nhập cạnh tranh',
      detail: 'Lương tháng 13, review 2 đợt mỗi năm và thưởng theo hiệu quả dự án.'
    },
    {
      title: 'Lịch làm việc linh hoạt',
      detail: 'Mô hình hybrid cho khối công nghệ và chính sách work-from-home theo team.'
    },
    {
      title: 'Học tập liên tục',
      detail: 'Tài trợ khóa học chuyên môn, workshop nội bộ và mentor 1-1 khi onboard.'
    },
    {
      title: 'Chăm sóc sức khỏe',
      detail: 'Bảo hiểm đầy đủ, check-up định kỳ và các hoạt động thể thao hằng quý.'
    }
  ];

  readonly processSteps: string[] = [
    'Gửi hồ sơ trực tiếp trên website (kèm CV).',
    'HR sàng lọc và phản hồi trong vòng 3 ngày làm việc.',
    'Phỏng vấn chuyên môn cùng team liên quan.',
    'Nhận offer và bắt đầu hành trình tại Skyline.'
  ];

  constructor(private recruitmentApi: RecruitmentApiService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.isLoadingJobs = true;
    this.recruitmentApi.getJobs(false).subscribe({
      next: (jobs) => {
        this.jobs = (jobs || []).map((job) => this.toViewJob(job));
        this.isLoadingJobs = false;

        if (!this.form.jobId && this.jobs.length > 0) {
          this.form.jobId = this.jobs[0].id;
        }
      },
      error: (error) => {
        console.error('Lỗi tải vị trí tuyển dụng:', error);
        this.jobs = [];
        this.isLoadingJobs = false;
      }
    });
  }

  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;

    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]);

    if (!allowedMimeTypes.has(file.type)) {
      this.showFormMessage('CV chỉ hỗ trợ định dạng PDF, DOC hoặc DOCX.', 'error');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showFormMessage('CV vượt quá 10MB. Vui lòng chọn tệp nhỏ hơn.', 'error');
      input.value = '';
      return;
    }

    this.selectedCvFile = file;
    this.selectedCvFileName = file.name;
  }

  submitApplication(): void {
    this.clearFormMessage();

    if (!this.form.jobId || !this.form.fullName.trim() || !this.form.email.trim()) {
      this.showFormMessage('Vui lòng chọn vị trí, nhập họ tên và email.', 'error');
      return;
    }

    if (!this.selectedCvFile) {
      this.showFormMessage('Vui lòng đính kèm CV trước khi gửi hồ sơ.', 'error');
      return;
    }

    this.isSubmitting = true;
    this.recruitmentApi.submitApplication({
      jobId: this.form.jobId,
      fullName: this.form.fullName.trim(),
      email: this.form.email.trim().toLowerCase(),
      phone: this.form.phone.trim(),
      coverLetter: this.form.coverLetter.trim(),
      cv: this.selectedCvFile
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showFormMessage('Gửi hồ sơ thành công. Skyline sẽ liên hệ bạn sớm nhất.', 'success');
        this.resetForm();
      },
      error: (error) => {
        this.isSubmitting = false;
        const message = String(error?.error?.error || error?.error?.message || 'Gửi hồ sơ thất bại. Vui lòng thử lại.');
        this.showFormMessage(message, 'error');
      }
    });
  }

  private toViewJob(job: RecruitmentJobModel): JobOpening {
    return {
      id: String(job._id || ''),
      title: job.title,
      team: job.team,
      location: job.location,
      type: job.type,
      level: job.level,
      salaryRange: job.salaryRange || 'Thỏa thuận',
      summary: job.summary,
      skills: Array.isArray(job.skills) ? job.skills : []
    };
  }

  private resetForm(): void {
    this.form = {
      jobId: this.jobs[0]?.id || '',
      fullName: '',
      email: '',
      phone: '',
      coverLetter: ''
    };
    this.selectedCvFile = null;
    this.selectedCvFileName = '';
  }

  private showFormMessage(message: string, type: 'success' | 'error'): void {
    this.formMessage = message;
    this.formMessageType = type;
  }

  private clearFormMessage(): void {
    this.formMessage = '';
  }
}
