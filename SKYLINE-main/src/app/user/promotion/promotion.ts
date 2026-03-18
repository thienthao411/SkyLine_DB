import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { PromotionApiModel, PromotionApiService } from '../../services/promotion-api.service';

interface Deal {
  id: string;
  image: string;
  label: string;
  date: string;
  details: string;
  target: string;
  applyTime: string;
  promoCode: string;
  sectionTitle: string;
  discountText: string;
  channelText: string;
  conditionText: string;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  items: Deal[];
  visibleCount: number;
  expanded: boolean;
}

@Component({
  selector: 'app-promotion',
  imports: [CommonModule, FormsModule, HttpClientModule, HeaderComponent, FooterComponent], 
  standalone: true,
  templateUrl: './promotion.html',
  styleUrl: './promotion.css',
})
export class Promotion implements OnInit { 
  selectedDeal: Deal | null = null;
  sections: Section[] = []; 
  filteredSections: Section[] = []; 
  searchTerm: string = ''; 
  copyStatusMessage: string | null = null; 
  pendingDealId: string | null = null;

  constructor(
    private promotionApi: PromotionApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void { 
    this.route.queryParamMap.subscribe((params) => {
      this.pendingDealId = params.get('itemId');
      this.tryOpenDealFromQuery();
    });

    this.loadPromotions();
  }

  // Tải dữ liệu từ API MongoDB
  loadPromotions() {
    this.promotionApi.getAll().subscribe({
      next: (data) => {
        this.sections = this.mapApiToSections(data);
        this.applyFilter();
        this.tryOpenDealFromQuery();
      },
      error: (error) => {
        console.error('Lỗi khi tải khuyến mãi từ API:', error);
        this.sections = [];
        this.filteredSections = [];
      }
    });
  }

  private mapApiToSections(data: PromotionApiModel[]): Section[] {
    const sectionMap: Record<string, Section> = {
      special: {
        id: 'special',
        title: 'Chiến dịch đặc biệt',
        icon: 'fa fa-bullhorn',
        items: [],
        visibleCount: 3,
        expanded: false
      },
      payment: {
        id: 'payment',
        title: 'Thanh toán & Trả sau',
        icon: 'fa fa-credit-card',
        items: [],
        visibleCount: 3,
        expanded: false
      },
      related: {
        id: 'related',
        title: 'Ưu đãi liên quan',
        icon: 'fa fa-tags',
        items: [],
        visibleCount: 3,
        expanded: false
      }
    };

    for (const promo of data || []) {
      const bucketId = this.resolveBucketId(promo.category);
      const bucket = sectionMap[bucketId];

      for (const [itemIndex, item] of (promo.items || []).entries()) {
        const promotionId = promo._id || '';
        bucket.items.push({
          id: promotionId ? `${promotionId}_${itemIndex}` : `${bucket.id}_${itemIndex}`,
          image: this.getPromoImageSrc(item.image),
          label: promo.title || item.label || '',
          date: item.date || '',
          details: item.details || promo.title || '',
          target: this.formatTarget(item.customerTargetType || item.target),
          applyTime: this.formatApplyTime(item.applyTime?.from, item.applyTime?.to),
          promoCode: item.promoCode || '',
          sectionTitle: bucket.title,
          discountText: this.formatDiscount(item.ruleType, item.discountValueRaw),
          channelText: this.formatChannel(item.applyChannel),
          conditionText: item.additionalCondition || 'Không có điều kiện bổ sung'
        });
      }
    }

    return Object.values(sectionMap)
      .filter(section => section.items.length > 0)
      .map(section => ({
        ...section,
        visibleCount: Math.min(3, section.items.length),
        expanded: false
      }));
  }

  private resolveBucketId(category?: string): 'special' | 'payment' | 'related' {
    if (category === 'payment') return 'payment';
    if (category === 'related') return 'related';
    return 'special';
  }

  private formatApplyTime(from?: string, to?: string): string {
    const fromText = from || 'Không giới hạn';
    const toText = to || 'Không giới hạn';
    return `${fromText} - ${toText}`;
  }

  private formatTarget(target?: string): string {
    const map: Record<string, string> = {
      all: 'Tất cả khách hàng',
      payment: 'Khách thanh toán theo phương thức',
      loyal: 'Khách hàng thân thiết',
      vip: 'Khách VIP',
      new: 'Khách hàng mới',
      returning: 'Khách hàng quay lại'
    };
    return target ? (map[target] || target) : 'Tất cả khách hàng';
  }

  private formatChannel(channel?: string): string {
    const map: Record<string, string> = {
      all: 'Toàn bộ hệ thống',
      online: 'Online',
      web: 'Website',
      app: 'Ứng dụng',
      momo: 'Momo',
      bank: 'Ngân hàng'
    };
    return channel ? (map[channel] || channel) : 'Toàn bộ hệ thống';
  }

  private formatDiscount(ruleType?: string, value?: number | null): string {
    if (value === null || value === undefined) return 'N/A';
    if (ruleType === 'percentage') return `${value}%`;
    return `${value.toLocaleString('vi-VN')} VND`;
  }

  private getPromoImageSrc(image?: string): string {
    if (!image) return 'https://placehold.co/400x200/cccccc/333333?text=Promo';
    if (image.startsWith('http') || image.startsWith('assets/')) return image;
    return `assets/img/${image}`;
  }

  // HÀM LỌC theo tên, mã, chi tiết, đối tượng, thời gian, nhóm ưu đãi
  applyFilter(): void {
    if (!this.sections || this.sections.length === 0) {
        this.filteredSections = [];
        return;
    }

    const term = this.normalizeText(this.searchTerm);

    if (!term) {
        // Nếu không có từ khóa, hiển thị toàn bộ sections
        this.filteredSections = this.sections.map(section => ({
            ...section,
            visibleCount: Math.min(3, section.items.length), 
            expanded: false
        }));
        return;
    }

        // Lọc theo từ khóa, bỏ dấu và không phân biệt hoa thường
    this.filteredSections = this.sections.map(section => {
        const filteredItems = section.items.filter(item => {
            const searchable = [
              item.label,
              item.details,
              item.promoCode,
              item.target,
              item.applyTime,
              item.sectionTitle,
              section.title,
              section.id
            ]
            .map(value => this.normalizeText(value))
            .join(' ');

            return searchable.includes(term);
        });

        // Trả về một section mới với items đã lọc
        return { 
            ...section, 
            items: filteredItems,
            visibleCount: filteredItems.length > 3 ? 3 : filteredItems.length, 
            expanded: false
        };
    })
    // Loại bỏ các section không còn ưu đãi nào sau khi lọc
    .filter(section => section.items.length > 0);
  }

  private normalizeText(value: string | null | undefined): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  // Hàm sao chép mã khuyến mãi (giữ nguyên)
  copyCode(code: string) {
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    try {
        document.execCommand('copy');
        this.copyStatusMessage = '✅ Đã sao chép mã khuyến mãi!';
    } catch (err) {
        this.copyStatusMessage = 'Lỗi: Không thể sao chép.';
    }
    document.body.removeChild(el);

    setTimeout(() => {
        this.copyStatusMessage = null;
    }, 3000);
  }

  // --- Các hàm logic hiển thị (ĐÃ DÙNG filteredSections) ---
  toggleSection(index: number) {
    const section = this.filteredSections[index]; 
    if (section.expanded) {
      section.visibleCount = 3;
    } else {
      section.visibleCount = section.items.length;
    }
    section.expanded = !section.expanded;
  }

  getVisibleItems(index: number): Deal[] {
    if (!this.filteredSections[index]) return []; 
    return this.filteredSections[index].items.slice(0, this.filteredSections[index].visibleCount); 
  }

  hasMoreItems(index: number): boolean {
    if (!this.filteredSections[index]) return false; 
    return this.filteredSections[index].visibleCount < this.filteredSections[index].items.length; 
  }

  canCollapse(index: number): boolean {
    if (!this.filteredSections[index]) return false; 
    return this.filteredSections[index].expanded && this.filteredSections[index].items.length > 3; 
  }

  // Hàm cuộn trang (giữ nguyên)
  scrollTo(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -100; 
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      
      document.querySelectorAll('.deals-tabs button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        }
      });
    }
  }

  openPopup(deal: Deal) {
    this.selectedDeal = deal;
    this.copyStatusMessage = null; 
  }

  private tryOpenDealFromQuery(): void {
    if (!this.pendingDealId || !this.sections.length) {
      return;
    }

    const matched = this.sections
      .flatMap((section) => section.items)
      .find((item) => item.id === this.pendingDealId);

    if (matched) {
      this.openPopup(matched);
      this.pendingDealId = null;
    }
  }

  closePopup() {
    this.selectedDeal = null;
  }
}