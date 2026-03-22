import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecruitmentJobModel {
  _id?: string;
  title: string;
  team: string;
  location: string;
  type: string;
  level: string;
  salaryRange: string;
  summary: string;
  skills: string[];
  status: 'open' | 'closed';
  createdAt?: string;
  updatedAt?: string;
}

export interface JobSummary {
  _id: string;
  title: string;
  team: string;
  location: string;
}

export interface JobApplicationModel {
  _id?: string;
  jobId: string | JobSummary;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  cvUrl: string;
  cvFileName: string;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface RecruitmentActivityModel {
  _id?: string;
  action:
    | 'job_created'
    | 'job_updated'
    | 'job_deleted'
    | 'application_submitted'
    | 'application_status_updated';
  applicationId?: {
    _id?: string;
    fullName?: string;
    email?: string;
    status?: string;
  } | string | null;
  jobId?: {
    _id?: string;
    title?: string;
  } | string | null;
  applicantName?: string;
  applicantEmail?: string;
  previousStatus?: string;
  nextStatus?: string;
  emailSent?: boolean;
  emailMessageId?: string;
  emailError?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecruitmentApiService {
  private apiUrl = 'http://localhost:5000/api/recruitment';

  constructor(private http: HttpClient) {}

  getJobs(includeClosed = false): Observable<RecruitmentJobModel[]> {
    return this.http.get<RecruitmentJobModel[]>(`${this.apiUrl}/jobs`, {
      params: { includeClosed: includeClosed ? 'true' : 'false' }
    });
  }

  createJob(payload: RecruitmentJobModel): Observable<RecruitmentJobModel> {
    return this.http.post<RecruitmentJobModel>(`${this.apiUrl}/jobs`, payload);
  }

  updateJob(id: string, payload: RecruitmentJobModel): Observable<RecruitmentJobModel> {
    return this.http.put<RecruitmentJobModel>(`${this.apiUrl}/jobs/${id}`, payload);
  }

  deleteJob(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/jobs/${id}`);
  }

  submitApplication(payload: {
    jobId: string;
    fullName: string;
    email: string;
    phone: string;
    coverLetter: string;
    cv: File;
  }): Observable<JobApplicationModel> {
    const formData = new FormData();
    formData.append('jobId', payload.jobId);
    formData.append('fullName', payload.fullName);
    formData.append('email', payload.email);
    formData.append('phone', payload.phone);
    formData.append('coverLetter', payload.coverLetter);
    formData.append('cv', payload.cv);

    return this.http.post<JobApplicationModel>(`${this.apiUrl}/applications`, formData);
  }

  getApplications(status = ''): Observable<JobApplicationModel[]> {
    return this.http.get<JobApplicationModel[]>(`${this.apiUrl}/applications`, {
      params: status ? { status } : {}
    });
  }

  getActivities(): Observable<RecruitmentActivityModel[]> {
    return this.http.get<RecruitmentActivityModel[]>(`${this.apiUrl}/activities`);
  }

  updateApplicationStatus(id: string, status: JobApplicationModel['status']): Observable<JobApplicationModel> {
    return this.http.patch<JobApplicationModel>(`${this.apiUrl}/applications/${id}/status`, { status });
  }
}
