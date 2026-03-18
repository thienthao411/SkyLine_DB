import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeaturedPromotionItem } from '../../../../services/promotion-api.service';
import { PromotionCardComponent } from '../promotion-card/promotion-card';

type PromotionCategoryKey = 'special' | 'payment' | 'related';

interface PromotionCategorySection {
  id: PromotionCategoryKey;
  title: string;
  iconClass: string;
  items: FeaturedPromotionItem[];
}

@Component({
  selector: 'app-promotion-list',
  imports: [CommonModule, RouterLink, PromotionCardComponent],
  templateUrl: './promotion-list.html',
  styleUrl: './promotion-list.css'
})
export class PromotionListComponent implements OnChanges {
  @Input() promotions: FeaturedPromotionItem[] = [];
  @Input() loading = false;

  readonly maxVisiblePerCategory = 3;

  readonly categoryMeta: Array<Omit<PromotionCategorySection, 'items'>> = [
    { id: 'special', title: 'Chiến dịch đặc biệt', iconClass: 'fa fa-bullhorn' },
    { id: 'payment', title: 'Thanh toán & Trả sau', iconClass: 'fa fa-credit-card' },
    { id: 'related', title: 'Ưu đãi liên quan', iconClass: 'fa fa-tags' }
  ];

  ngOnChanges(): void {
    // No local paging state to reset; keep method for input change lifecycle.
  }

  get sections(): PromotionCategorySection[] {
    return this.categoryMeta.map((meta) => {
      const items = this.promotions
        .filter((promotion) => this.resolveCategory(promotion.category) === meta.id)
        .slice(0, this.maxVisiblePerCategory);

      return {
        ...meta,
        items
      };
    });
  }

  private resolveCategory(category: string | undefined): PromotionCategoryKey {
    if (category === 'payment') return 'payment';
    if (category === 'related') return 'related';
    return 'special';
  }

  trackByPromotionId(_index: number, item: FeaturedPromotionItem): string {
    return item.id;
  }
}
