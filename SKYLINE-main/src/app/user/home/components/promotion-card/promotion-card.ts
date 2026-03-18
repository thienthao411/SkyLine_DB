import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeaturedPromotionItem } from '../../../../services/promotion-api.service';

@Component({
  selector: 'app-promotion-card',
  imports: [CommonModule, RouterLink],
  templateUrl: './promotion-card.html',
  styleUrl: './promotion-card.css'
})
export class PromotionCardComponent {
  @Input({ required: true }) promotion!: FeaturedPromotionItem;
  @Input() large = false;

  get promotionPeriod(): string {
    const start = this.formatDate(this.promotion?.startDate);
    const end = this.formatDate(this.promotion?.endDate);

    if (start && end) {
      return `${start} - ${end}`;
    }

    if (start) {
      return `Bắt đầu: ${start}`;
    }

    if (end) {
      return `Kết thúc: ${end}`;
    }

    return 'Đang cập nhật thời gian áp dụng';
  }

  get imageSrc(): string {
    if (!this.promotion?.image) {
      return 'https://placehold.co/800x450/e7e8ff/23285a?text=Khuyen+mai';
    }

    if (
      this.promotion.image.startsWith('http') ||
      this.promotion.image.startsWith('assets/') ||
      this.promotion.image.startsWith('/assets/') ||
      this.promotion.image.startsWith('data:image/')
    ) {
      return this.promotion.image;
    }

    return `assets/img/${this.promotion.image}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://placehold.co/800x450/e7e8ff/23285a?text=Khuyen+mai';
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('vi-VN');
  }
}
