import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { BlogApiService, BlogModel } from '../../services/blog-api.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, HttpClientModule, HeaderComponent, FooterComponent],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.css',
})
export class BlogDetailComponent implements OnInit {
  blog: BlogModel | null = null;
  isLoading = true;

  constructor(private route: ActivatedRoute, private blogApi: BlogApiService) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.isLoading = false;
      return;
    }

    this.blogApi.getBySlug(slug).subscribe({
      next: (data) => {
        this.blog = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  get formattedDate(): string {
    if (!this.blog?.publishedAt) return 'Chưa cập nhật';
    return new Date(this.blog.publishedAt).toLocaleDateString('vi-VN');
  }
}
