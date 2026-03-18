import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FooterComponent } from '../shared/footer/footer';
import { HeaderComponent } from '../shared/header/header';
import { FeaturedPromotionItem, PromotionApiService } from '../../services/promotion-api.service';

@Component({
  selector: 'app-promotion-detail',
  imports: [CommonModule, RouterLink, HeaderComponent, FooterComponent],
  templateUrl: './promotion-detail.html',
  styleUrl: './promotion-detail.css'
})
export class PromotionDetailComponent implements OnInit {
  promotion: FeaturedPromotionItem | null = null;
  isLoading = true;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private promotionApi: PromotionApiService
  ) {}

  ngOnInit(): void {
    const itemId = this.route.snapshot.paramMap.get('promotionItemId');

    if (!itemId) {
      this.isLoading = false;
      this.notFound = true;
      return;
    }

    this.promotionApi.getFeaturedById(itemId).subscribe({
      next: (promotion) => {
        this.promotion = promotion;
        this.isLoading = false;
      },
      error: () => {
        this.notFound = true;
        this.isLoading = false;
      }
    });
  }

  get imageSrc(): string {
    if (!this.promotion?.image) {
      return 'https://placehold.co/1000x560/e7e8ff/23285a?text=Khuyen+mai';
    }

    if (
      this.promotion.image.startsWith('http') ||
      this.promotion.image.startsWith('assets/') ||
      this.promotion.image.startsWith('/assets/')
    ) {
      return this.promotion.image;
    }

    return `assets/img/${this.promotion.image}`;
  }

  get validityText(): string {
    if (!this.promotion) return 'Đang cập nhật';

    const startText = this.promotion.startDate
      ? new Date(this.promotion.startDate).toLocaleDateString('vi-VN')
      : 'Ngay lập tức';
    const endText = this.promotion.endDate
      ? new Date(this.promotion.endDate).toLocaleDateString('vi-VN')
      : 'Không giới hạn';

    return `${startText} - ${endText}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://placehold.co/1000x560/e7e8ff/23285a?text=Khuyen+mai';
  }
}
