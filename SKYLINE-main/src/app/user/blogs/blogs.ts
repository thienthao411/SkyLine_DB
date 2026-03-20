import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { BlogApiService, BlogModel } from '../../services/blog-api.service';

@Component({
  selector: 'app-blogs',
  standalone: true,
  imports: [CommonModule, RouterLink, HttpClientModule, HeaderComponent, FooterComponent],
  templateUrl: './blogs.html',
  styleUrl: './blogs.css',
})
export class BlogsComponent implements OnInit {
  posts: BlogModel[] = [];

  constructor(private blogApi: BlogApiService) {}

  ngOnInit(): void {
    this.blogApi.getPublished().subscribe({
      next: (data) => {
        this.posts = Array.isArray(data) ? data : [];
      },
      error: (error) => {
        console.error('Loi tai blogs published:', error);
      },
    });
  }

  get featuredPost(): BlogModel | null {
    if (this.posts.length === 0) return null;
    const featured = this.posts.find((item) => item.isFeatured);
    return featured || this.posts[0] || null;
  }

  get latestPosts(): BlogModel[] {
    const featured = this.featuredPost;
    if (!featured) return [];
    const featuredSlug = featured.slug;
    const rest = this.posts.filter((item) => item.slug !== featuredSlug);
    if (rest.length > 0) return rest;
    return this.posts.slice(1);
  }
}
