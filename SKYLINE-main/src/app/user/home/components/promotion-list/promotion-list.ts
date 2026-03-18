import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeaturedPromotionItem } from '../../../../services/promotion-api.service';
import { PromotionCardComponent } from '../promotion-card/promotion-card';

@Component({
  selector: 'app-promotion-list',
  imports: [CommonModule, RouterLink, PromotionCardComponent],
  templateUrl: './promotion-list.html',
  styleUrl: './promotion-list.css'
})
export class PromotionListComponent {
  @Input() promotions: FeaturedPromotionItem[] = [];
  @Input() loading = false;

  get visiblePromotions(): FeaturedPromotionItem[] {
    return this.promotions.slice(0, 3);
  }

  trackByPromotionId(_index: number, item: FeaturedPromotionItem): string {
    return item.id;
  }
}
