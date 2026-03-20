import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { BlogApiService, BlogModel } from '../../services/blog-api.service';

@Component({
  selector: 'app-blog-management',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, AdminSidebarComponent, AdminHeader],
  templateUrl: './blog-management.html',
  styleUrl: './blog-management.css',
})
export class BlogManagementComponent implements OnInit {
  activeMainTab: 'create' | 'manage' = 'manage';
  showModalType: 'view' | null = null;
  readonly fallbackCover = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0%25" stop-color="%231b4f72"/%3E%3Cstop offset="100%25" stop-color="%234f93c3"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="960" height="540" fill="url(%23g)"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="36" opacity="0.88"%3ESkyline Blog%3C/text%3E%3C/svg%3E';
  blogs: BlogModel[] = [];
  blogToView: BlogModel | null = null;
  selectedBlogId: string | null = null;
  searchTerm = '';

  form: BlogModel = this.createEmptyForm();

  constructor(private blogApi: BlogApiService) {}

  ngOnInit(): void {
    this.loadBlogs();
  }

  switchMainTab(tab: 'create' | 'manage'): void {
    this.activeMainTab = tab;
  }

  get filteredBlogs(): BlogModel[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.blogs;
    return this.blogs.filter((b) =>
      [b.title, b.slug, b.category, b.author, b.status].some((v) =>
        String(v || '').toLowerCase().includes(term)
      )
    );
  }

  loadBlogs(): void {
    this.blogApi.getAll().subscribe({
      next: (data) => {
        this.blogs = data;
      },
      error: (error) => {
        console.error('Loi tai blogs:', error);
      },
    });
  }

  selectForEdit(blog: BlogModel): void {
    this.activeMainTab = 'create';
    this.selectedBlogId = blog._id || null;
    this.form = {
      _id: blog._id,
      title: blog.title,
      slug: blog.slug,
      category: blog.category,
      author: blog.author,
      readTime: blog.readTime,
      excerpt: blog.excerpt,
      coverTone: blog.coverTone,
      coverImage: blog.coverImage,
      highlights: [...(blog.highlights || [])],
      sections: [...(blog.sections || [])],
      status: blog.status,
      isFeatured: !!blog.isFeatured,
      publishedAt: blog.publishedAt,
    };
  }

  resetForm(): void {
    this.selectedBlogId = null;
    this.form = this.createEmptyForm();
  }

  saveBlog(): void {
    const payload = {
      ...this.form,
      slug: this.slugify(this.form.slug || this.form.title),
      coverImage: this.form.coverImage || '',
      highlights: [...(this.form.highlights || [])],
      sections: [...(this.form.sections || [])],
    } as BlogModel;

    if (!payload.title.trim()) return;

    if (this.selectedBlogId) {
      this.blogApi.update(this.selectedBlogId, payload).subscribe({
        next: () => {
          this.loadBlogs();
          this.resetForm();
          this.activeMainTab = 'manage';
        },
        error: (error) => console.error('Loi cap nhat blog:', error),
      });
      return;
    }

    this.blogApi.create(payload).subscribe({
      next: () => {
        this.loadBlogs();
        this.resetForm();
        this.activeMainTab = 'manage';
      },
      error: (error) => console.error('Loi tao blog:', error),
    });
  }

  viewBlog(blog: BlogModel): void {
    this.blogToView = blog;
    this.showModalType = 'view';
  }

  closeModal(): void {
    this.showModalType = null;
    this.blogToView = null;
  }

  getSectionPreview(blog: BlogModel): string {
    const sections = blog.sections || [];
    if (sections.length === 0) return 'Chưa có nội dung chi tiết';
    return `${sections.length} mục nội dung`;
  }

  trackByBlog(index: number, blog: BlogModel): string {
    return blog._id || `${blog.slug}-${index}`;
  }

  formHighlightsText(): string {
    return (this.form.highlights || []).join('\n');
  }

  formSectionsText(): string {
    return (this.form.sections || [])
      .map((sec) => `${sec.heading}\n${(sec.paragraphs || []).join('\n')}`)
      .join('\n\n---\n\n');
  }

  updateHighlightsText(value: string): void {
    this.form.highlights = value.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  updateSectionsText(value: string): void {
    this.form.sections = this.parseSectionsFromText(value);
  }

  onCoverImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const maxBytes = 5 * 1024 * 1024;
    if (!isImage || file.size > maxBytes) {
      input.value = '';
      return;
    }

    this.fileToDataUrl(file)
      .then((dataUrl) => {
        this.form.coverImage = dataUrl;
      })
      .catch((error) => {
        console.error('Loi doc anh bia:', error);
      })
      .finally(() => {
        input.value = '';
      });
  }

  removeCoverImage(): void {
    this.form.coverImage = '';
  }

  private parseSectionsFromText(value: string): Array<{ heading: string; paragraphs: string[] }> {
    const rawBlocks = String(value || '').split(/\n\s*---\s*\n/g);
    return rawBlocks
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        return {
          heading: lines[0] || `Muc ${index + 1}`,
          paragraphs: lines.slice(1),
        };
      });
  }

  private slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Khong the doc tep'));
      reader.readAsDataURL(file);
    });
  }

  private createEmptyForm(): BlogModel {
    return {
      title: '',
      slug: '',
      category: 'Kinh nghiệm',
      author: 'Skyline Editorial Team',
      readTime: '5 phút đọc',
      excerpt: '',
      coverTone: 'ocean',
      coverImage: '',
      highlights: [],
      sections: [],
      status: 'published',
      isFeatured: false,
      publishedAt: new Date().toISOString(),
    };
  }
}
