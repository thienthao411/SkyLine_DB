import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';

@Component({
  selector: 'app-intro',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './intro.html',
  styleUrl: './intro.css',
})
export class Intro {
  teamMembers = [
    { name: 'Trịnh Thị Thùy Trang', image: 'assets/img/intro/thuytrang.png' },
    { name: 'Phạm Thị Hoài Thương', image: 'assets/img/intro/hoaithuong.png' },
    { name: 'Đào Thị Cẩm Vy', image: 'assets/img/intro/camvy.png' },
    { name: 'Trần Thị Thiên Thảo', image: 'assets/img/intro/thienthao.png' },
    { name: 'Nguyễn Ngọc Tường Vy', image: 'assets/img/intro/tuongvy.png' }
  ];

  featuredIndex = 2; // Member ở giữa (index 2)

  nextSlide() {
    if (this.featuredIndex < this.teamMembers.length - 1) {
      this.featuredIndex++;
    }
  }

  prevSlide() {
    if (this.featuredIndex > 0) {
      this.featuredIndex--;
    }
  }

  isFeatured(index: number): boolean {
    return index === this.featuredIndex;
  }

  getVisibleMembers() {
    // Hiển thị 5 members: 2 bên trái, 1 giữa (featured), 2 bên phải
    const start = Math.max(0, this.featuredIndex - 2);
    const end = Math.min(this.teamMembers.length, this.featuredIndex + 3);
    return this.teamMembers.slice(start, end);
  }

  getMemberIndex(member: any): number {
    return this.teamMembers.indexOf(member);
  }
}
