import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

@Component({
  selector: 'app-contact',
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  submitted = false;
  submitError = '';
  isSubmitting = false;
  form = {
    fullName: '',
    email: '',
    topic: '',
    message: '',
  };

  constructor(private http: HttpClient) {}

  onSubmit(event: Event) {
    event.preventDefault();
    if (this.isSubmitting) return;

    this.submitError = '';
    this.isSubmitting = true;

    this.http.post<{ success: boolean }>('http://localhost:5000/api/supports', this.form).pipe(
      catchError((error) => {
        // Backward compatibility: if backend has not been restarted to new route yet.
        if (error?.status === 404) {
          return this.http.post<{ success: boolean }>('http://localhost:5000/api/notifications/support-request', this.form);
        }
        return throwError(() => error);
      })
    ).subscribe({
      next: () => {
        this.submitted = true;
        this.isSubmitting = false;

        this.form = {
          fullName: '',
          email: '',
          topic: '',
          message: '',
        };

        setTimeout(() => {
          this.submitted = false;
        }, 3000);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitError = error?.error?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.';
      }
    });
  }
}