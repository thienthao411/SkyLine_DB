import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeaturedPromotionItem } from '../../../../services/promotion-api.service';
import { PromotionCardComponent } from '../promotion-card/promotion-card';

@Component({
  selector: 'app-promotion-list',
  imports: [CommonModule, RouterLink, PromotionCardComponent],
  templateUrl: './promotion-list.html',
  styleUrl: './promotion-list.css'
})
export class PromotionListComponent implements OnChanges {
  @Input() promotions: FeaturedPromotionItem[] = [];
  @Input() loading = false;

  readonly maxVisible = 4;
  currentStart = 0;

  ngOnChanges(): void {
    this.currentStart = 0;
  }

  get visiblePromotions(): FeaturedPromotionItem[] {
    return this.promotions.slice(this.currentStart, this.currentStart + this.maxVisible);
  }

  get canSlide(): boolean {
    return this.promotions.length > this.maxVisible;
  }

  previous(): void {
    if (!this.canSlide) return;
    this.currentStart =
      this.currentStart === 0 ? this.promotions.length - this.maxVisible : this.currentStart - 1;
  }

  next(): void {
    if (!this.canSlide) return;
    this.currentStart =
      this.currentStart >= this.promotions.length - this.maxVisible ? 0 : this.currentStart + 1;
  }

  trackById(_index: number, item: FeaturedPromotionItem): string {
    return item.id;
  }
}
