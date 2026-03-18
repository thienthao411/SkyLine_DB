import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Cần đảm bảo các imports này được xử lý trong module cha (nếu không phải standalone)
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';
import { PromotionApiModel, PromotionApiService } from '../../services/promotion-api.service';

// --- INTERFACES ---
interface Promotion {
  promoId: string;
  promoName: string;
  promoCode: string;
    isFeatured: boolean;
  promoType: string; 
  discountValue: number | null;
  maxDiscountAmount: number | null;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
  notes: string;
  endTime: string;
  descriptionPlaceholder?: string;
  applyHour: string;
  applyDayOfWeek: string;
  applyDayOfMonth: string;
  applyMonth: string;
  applyYear: string;
  applyTimeframe: string;
  flightRoutes: string;
  ticketClass: string;
  minTickets: number | null;
  ruleType: string;
  additionalCondition: string;
  departureAirport: string; 
  arrivalAirport: string;
  minOrderValue: number | null;
  territory: string;
  applyCountType: string;
  applyChannel: string;
  customerTargetType: string;
}

interface JsonItem {
  image: string;
  label: string;
  date: string;
  details: string; 
    isFeatured?: boolean;
    startDate?: string;
    endDate?: string;
  target: string;
    applyTime: {
        from: string;
        to: string;
    } | string;
  promoCode: string;
  maxDiscountAmount?: number | null;
  discountValueRaw?: number | null; 
  flightRoutes?: string;
  ticketClass?: string;
  minTickets?: number | null;
  ruleType?: string;
  additionalCondition?: string;
  departureAirport?: string; 
  arrivalAirport?: string;
  minOrderValue?: number | null;
  territory?: string;
  applyCountType?: string; 
  applyChannel?: string;
  customerTargetType?: string;
}

interface PromoCategory {
    _id?: string;
    id?: string;
  title: string;
  icon: string;
    isFeatured?: boolean;
  items: JsonItem[];
    category?: string;
  visibleCount: number;
  expanded: boolean;
}

interface PromoListItem {
  id: number;
    dbPromotionId: string;
  name: string;
    rawLabel: string;
    promoCode: string;
  startDate: string;
  endDate: string;
  type: string;
  applyTarget: string;
    isFeatured: boolean;
  status: 'active' | 'upcoming' | 'expired' | 'draft';
  jsonCategoryId: string;
  jsonItemIndex: number;
}

@Component({
  selector: 'app-promotion-management',
  standalone: true,
  imports: [
      CommonModule,
      FormsModule,
      HttpClientModule,
      AdminSidebarComponent, 
      AdminHeader 
  ],
  templateUrl: './promotion-management.html',
  styleUrl: './promotion-management.css',
})

export class PromotionManagement implements OnInit {
  activeMainTab: 'create' | 'manage' = 'manage'; 
  activeStep: 'info' | 'apply' = 'info';
    showSuccessPopup = false;
    successPopupMessage = '';
    private successPopupTimer: ReturnType<typeof setTimeout> | null = null;

  searchTerm: string = '';
  selectedStatusFilter: string = 'all';
  selectedTypeFilter: string = 'all';
  isLimitedTime: boolean = false;
  isFormInvalid: boolean = true;
  isDraftInvalid: boolean = true;
  showModalType: 'cancel' | 'draft' | 'activate' | 'view' | null = null; 
  
  promoToView: PromoListItem | null = null; 
  rawJsonData: PromoCategory[] = []; 
    editingPromotionId: string | null = null;
  
  currentPromotion: Promotion = {
      promoId: '', promoName: '', promoCode: '', isFeatured: false, promoType: 'percent', discountValue: null,
      maxDiscountAmount: null, startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'inactive', notes: '',
      endTime: '', descriptionPlaceholder: '', applyHour: 'any', applyDayOfWeek: 'any',
      applyDayOfMonth: 'any', applyMonth: 'any', applyYear: 'any', applyTimeframe: 'any',
      flightRoutes: '', ticketClass: '', minTickets: null, ruleType: '', additionalCondition: '',
      departureAirport: '', arrivalAirport: '', minOrderValue: null, territory: '',
      applyCountType: '1', applyChannel: 'all', customerTargetType: 'all',
  };

  promos: PromoListItem[] = [];
  
  hours = Array.from({length: 24}, (_, i) => i < 10 ? `0${i}` : `${i}`);
  daysOfWeek = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  daysOfMonth = Array.from({length: 31}, (_, i) => i + 1);
  months = Array.from({length: 12}, (_, i) => i + 1);
  years = Array.from({length: 5}, (_, i) => new Date().getFullYear() + i);
  timeframes = ['Sáng (06:00-11:59)', 'Chiều (12:00-17:59)', 'Tối (18:00-23:59)', 'Khuya (00:00-05:59)'];

  // 🟢 Dữ liệu mô tả loại hình khuyến mãi
  promoTypeDescriptions = {
      'percent': 'Giảm phần trăm',
      'amount': 'Giảm số tiền',
      'freeship': 'Miễn phí vận chuyển',
      'point': 'Thưởng điểm',
      'combo': 'Combo/Dịch vụ',
      'refund': 'Hoàn tiền',
      'default': 'Ưu đãi chung'
  };

  statusOptions = [
      { value: 'all', label: 'Tất cả trạng thái' },
      { value: 'active', label: 'Đang chạy' },
      { value: 'upcoming', label: 'Sắp diễn ra' },
      { value: 'expired', label: 'Hết hạn' },
  ];

  typeOptions = [
      { value: 'all', label: 'Tất cả ưu đãi' },
      { value: 'percent', label: 'Giảm phần trăm' },
      { value: 'amount', label: 'Giảm số tiền' },
      { value: 'point', label: 'Thưởng điểm' },
      { value: 'combo', label: 'Combo/Dịch vụ' },
      { value: 'refund', label: 'Hoàn tiền' },
  ];

    constructor(private promotionApi: PromotionApiService) { }
  
  ngOnInit(): void {
      this.loadPromoData(); 
      this.updateFormValidity();
  }
  
  // 🟢 HÀM TRẢ VỀ MÔ TẢ THÂN THIỆN CHO BẢNG
  getPromoTypeLabel(typeCode: string): string {
      return this.promoTypeDescriptions[typeCode as keyof typeof this.promoTypeDescriptions] || this.promoTypeDescriptions['default'];
  }

  formatApplyTarget(target: string): string {
      const map: Record<string, string> = {
          all: 'Tất cả khách hàng',
          new: 'Khách hàng mới',
          returning: 'Khách hàng quay lại',
          gold: 'Thành viên hạng Vàng',
          silver: 'Thành viên hạng Bạc',
          vip: 'Khách VIP',
          payment: 'Khách theo phương thức thanh toán',
          loyal: 'Khách hàng thân thiết'
      };
      return map[target] || target || 'N/A';
  }

  formatApplyCount(value?: string): string {
      if (value === 'multiple' || value === 'multi' || value === 'unlimited') return 'Nhiều lần';
      if (value === '1' || value === 'once') return 'Một lần';
      return value || 'N/A';
  }

  formatApplyChannel(value?: string): string {
      const map: Record<string, string> = {
          all: 'Toàn bộ hệ thống',
          specific: 'Hãng bay cụ thể',
          online: 'Online',
          web: 'Website',
          app: 'Ứng dụng',
          momo: 'Momo',
          bank: 'Ngân hàng'
      };
      return value ? (map[value] || value) : 'N/A';
  }

  formatDiscountValue(type: string, value?: number | null): string {
      if (value === null || value === undefined) return 'N/A';
      if (type === 'percent') return `${value}%`;
      return `${value.toLocaleString('vi-VN')} VND`;
  }

  getPromoImageSrc(image?: string): string {
      if (!image) return 'assets/img/default_promo.jpg';
      if (image.startsWith('http') || image.startsWith('assets/')) return image;
      return `assets/img/${image}`;
  }

  loadPromoData() {
      this.promotionApi.getAll().subscribe({
          next: (data) => {
              this.rawJsonData = data.map((category: PromotionApiModel) => ({
                  ...category,
                  visibleCount: category.items?.length || 0,
                  expanded: false
              }));

              let promoIdCounter = 1;
              const flattenedPromos: PromoListItem[] = [];

              this.rawJsonData.forEach(category => {
                  const categoryId = category._id || category.id || '';

                  (category.items || []).forEach((item, index) => {
                      const from = item.startDate || this.getApplyFrom(item.applyTime);
                      const to = item.endDate || this.getApplyTo(item.applyTime);
                      const rawLabel = (category.title || item.label || '').replace(/\*\*/g, '').trim();
                      const type = this.detectPromoType(item);
                      const displayName = this.buildPromoDisplayName(rawLabel, item, type);

                      flattenedPromos.push({
                          id: promoIdCounter++,
                          dbPromotionId: categoryId,
                          name: displayName,
                          rawLabel,
                          promoCode: (item.promoCode || '').trim(),
                          startDate: from,
                          endDate: to || 'Vô thời hạn',
                          type,
                          applyTarget: item.customerTargetType || item.target || 'all',
                          isFeatured: Boolean(item.isFeatured ?? category.isFeatured),
                          status: this.getPromoStatus(item, to),
                          jsonCategoryId: categoryId,
                          jsonItemIndex: index
                      });
                  });
              });

              this.promos = flattenedPromos;
          },
          error: (err) => {
              console.error('Lỗi khi tải dữ liệu khuyến mãi từ API:', err);
          }
      });
  }

  getPromoRawData(): JsonItem | null {
    if (!this.promoToView || !this.rawJsonData) return null;

    // 🟢 1. XỬ LÝ CHƯƠNG TRÌNH ĐƯỢC TẠO MỚI GIẢ
    const category = this.rawJsonData.find(c => (c._id || c.id) === this.promoToView!.jsonCategoryId);
    if (category && category.items.length > this.promoToView.jsonItemIndex) {
         return category.items[this.promoToView.jsonItemIndex];
    }
    return null;
}

  viewPromo(id: number) {
      this.promoToView = this.promos.find(p => p.id === id) || null;
      if (this.promoToView) {
          this.showModalType = 'view';
      }
  }
  
  closeViewModal() {
      this.showModalType = null;
      this.promoToView = null;
  }


  editPromo(id: number) {
      const promoItem = this.promos.find(p => p.id === id);
      this.promoToView = promoItem || null; 
      
      if (promoItem) {
          const rawData = this.getPromoRawData(); 
          this.editingPromotionId = promoItem.dbPromotionId;
          
          // Lấy giá trị số đã làm sạch từ rawData (FIX LỖI)
          let discountValue = rawData?.discountValueRaw || 0;

          this.currentPromotion = {
              ...this.currentPromotion,
              promoName: ((promoItem.rawLabel || rawData?.label || promoItem.name) || '').replace(/\*\*/g, '').trim(), 
              promoCode: rawData?.promoCode || `CODE-${promoItem.id}`, 
              isFeatured: Boolean(rawData?.isFeatured),
              
              // 🟢 FIX: Ánh xạ promoType là MÃ CODE và discountValue là GIÁ TRỊ SỐ
              promoType: promoItem.type, // Là mã code: 'percent', 'combo', etc.
              discountValue: discountValue,
              
              maxDiscountAmount: rawData?.maxDiscountAmount || null,
              startDate: rawData?.startDate || this.getApplyFrom(rawData?.applyTime || '') || promoItem.startDate,
              endDate: rawData?.endDate || this.getApplyTo(rawData?.applyTime || '') || (promoItem.endDate !== 'Vô thời hạn' ? promoItem.endDate : ''),
              status: promoItem.status === 'active' ? 'active' : 'inactive',
              descriptionPlaceholder: rawData?.details || '', 
              
              // MAP CÁC TRƯỜNG CHI TIẾT
              flightRoutes: rawData?.flightRoutes || '',
              ticketClass: rawData?.ticketClass || '',
              minTickets: rawData?.minTickets || 1, 
              ruleType: rawData?.ruleType || '',
              additionalCondition: rawData?.additionalCondition || '',
              departureAirport: rawData?.departureAirport || '',
              arrivalAirport: rawData?.arrivalAirport || '',
              minOrderValue: rawData?.minOrderValue || 0,
              territory: rawData?.territory || '',
              applyCountType: rawData?.applyCountType || '1',
              applyChannel: rawData?.applyChannel || 'all',
              customerTargetType: rawData?.customerTargetType || 'all',
          };
          this.isLimitedTime = promoItem.endDate !== 'Vô thời hạn';
          
          this.activeMainTab = 'create';
          this.activeStep = 'info';
          this.updateFormValidity();
          this.closeViewModal();
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
           alert(`Không tìm thấy khuyến mãi ID: ${id}`);
      }
  }

  createEmptyPromotion(): Promotion {
    return {
    promoId: '', promoName: '', promoCode: '', isFeatured: false, promoType: 'percent', discountValue: null,
                maxDiscountAmount: null, startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'inactive', notes: '',
        endTime: '', descriptionPlaceholder: '', applyHour: 'any', applyDayOfWeek: 'any',
        applyDayOfMonth: 'any', applyMonth: 'any', applyYear: 'any', applyTimeframe: 'any',
        flightRoutes: '', ticketClass: '', minTickets: null, ruleType: '', additionalCondition: '',
        departureAirport: '', arrivalAirport: '', minOrderValue: null, territory: '',
        applyCountType: '1', applyChannel: 'all', customerTargetType: 'all',
    };
}
    
    // --- Các Logic Khác (Giữ nguyên) ---
    switchMainTab(tab: 'create' | 'manage') {
      this.activeMainTab = tab;
      if (tab === 'create') {
          // 🟢 FIX: Reset form khi chuyển sang tab tạo mới
          this.currentPromotion = this.createEmptyPromotion(); 
                    this.editingPromotionId = null;
          this.activeStep = 'info'; 
          this.isLimitedTime = false;
          this.updateFormValidity();
      }
      // Khi chuyển sang tab 'manage', đóng modal xem chi tiết nếu có
      if (tab === 'manage') {
          this.closeViewModal();
      }
  }

    switchStep(step: 'info' | 'apply') {
        if (step === 'apply' && this.isFormInvalid) {
            alert('Vui lòng điền Tên, Mã và Giá trị giảm (nếu có) trước khi tiếp tục.');
            return;
        }

        this.activeStep = step;
        this.updateFormValidity();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateFormValidity() {
        const p = this.currentPromotion;
        let requiredValid = true;
        let draftValid = true;    

        if (!p.promoName || p.promoName.trim() === '' || !p.promoCode || p.promoCode.trim() === '') {
            draftValid = false;
        }

        if (!draftValid || p.promoType !== 'freeship' && (p.discountValue === null || p.discountValue <= 0)) {
            requiredValid = false;
        }

        if (requiredValid && this.isLimitedTime && (!p.endDate || p.endDate.trim() === '')) {
            requiredValid = false;
        }

        if (requiredValid && this.isLimitedTime) {
            const fromDate = this.parseDate(p.startDate);
            const toDate = this.parseDate(p.endDate);
            if (fromDate && toDate && toDate < fromDate) {
                requiredValid = false;
            }
        }

        this.isDraftInvalid = !draftValid;
        this.isFormInvalid = !requiredValid;
    }

    onDiscountTypeChange(type: string) {
        if (type === 'freeship') {
            this.currentPromotion.discountValue = null;
            this.currentPromotion.maxDiscountAmount = null;
        }

        this.updateFormValidity();
    }

    addTimeDetail() {
        alert(`Đã thêm lịch áp dụng chi tiết: Giờ=${this.currentPromotion.applyHour}, Thứ=${this.currentPromotion.applyDayOfWeek}, Ngày=${this.currentPromotion.applyDayOfMonth}`);
    }

    get filteredPromos(): PromoListItem[] {
        let result = this.promos;
        const term = this.searchTerm.trim().toLowerCase();
        
        if (this.selectedStatusFilter !== 'all') {
            result = result.filter(p => p.status === this.selectedStatusFilter);
        }

        if (this.selectedTypeFilter !== 'all') {
            result = result.filter(p => p.type === this.selectedTypeFilter);
        }

        if (term) {
            result = result.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.promoCode.toLowerCase().includes(term) ||
                p.applyTarget.toLowerCase().includes(term) ||
                p.type.toLowerCase().includes(term)
            );
        }

        return result;
    }

    deletePromo(id: number) {
        const target = this.promos.find(p => p.id === id);
        if (!target?.dbPromotionId) return;

        if (confirm(`Bạn có chắc chắn muốn xóa khuyến mãi ID ${id} không?`)) {
            this.promotionApi.delete(target.dbPromotionId).subscribe({
                next: () => {
                    this.promos = this.promos.filter(p => p.id !== id);
                    this.rawJsonData = this.rawJsonData.filter(c => (c._id || c.id) !== target.dbPromotionId);
                },
                error: (err) => console.error('Lỗi xóa khuyến mãi:', err)
            });
        }
    }

    promptAction(type: 'cancel' | 'draft' | 'activate') {
        if (type === 'activate' && this.isFormInvalid) return; 
        if (type === 'draft' && this.isDraftInvalid) return; 
        this.showModalType = type;
    }

    closeModal() {
        this.showModalType = null;
    }

    confirmAction() {
      if (this.showModalType === 'cancel') {
          this.currentPromotion = this.createEmptyPromotion();
          this.editingPromotionId = null;
          this.activeMainTab = 'manage';
          this.activeStep = 'info';
          this.isLimitedTime = false;
      } else if (this.showModalType === 'draft' || this.showModalType === 'activate') {
          const isEditing = !!this.editingPromotionId;
          const status = this.showModalType === 'activate' ? 'active' : 'draft';
          const payload = this.buildPromotionPayload(status);

          const request$ = this.editingPromotionId
              ? this.promotionApi.update(this.editingPromotionId, payload)
              : this.promotionApi.create(payload);

          request$.subscribe({
              next: () => {
                                    this.openSuccessPopup(
                                        isEditing
                                            ? 'Chỉnh sửa khuyến mãi thành công!'
                                            : `Đã ${this.showModalType === 'activate' ? 'Lưu & Kích hoạt' : 'Lưu bản nháp'} chương trình thành công!`
                                    );
                  this.activeMainTab = 'manage';
                  this.currentPromotion = this.createEmptyPromotion();
                  this.editingPromotionId = null;
                  this.isLimitedTime = false;
                  this.loadPromoData();
              },
              error: (err) => {
                  console.error('Lỗi lưu khuyến mãi:', err);
                  alert('Không thể lưu khuyến mãi. Vui lòng kiểm tra backend/MongoDB.');
              }
          });
      }
      this.closeModal();
    }

    private openSuccessPopup(message: string): void {
        this.successPopupMessage = message;
        this.showSuccessPopup = true;

        if (this.successPopupTimer) {
            clearTimeout(this.successPopupTimer);
        }

        this.successPopupTimer = setTimeout(() => {
            this.showSuccessPopup = false;
            this.successPopupTimer = null;
        }, 2200);
    }

    saveAndContinue() {
        if (this.isFormInvalid) {
            alert('Vui lòng điền Tên, Mã và Giá trị giảm (nếu có) trước khi tiếp tục.');
            return;
        }
        this.switchStep('apply');
    }

    private getApplyFrom(applyTime: JsonItem['applyTime']): string {
        if (typeof applyTime === 'string') {
            return applyTime.split('–')[0]?.trim() || '';
        }
        return applyTime?.from || '';
    }

    private getApplyTo(applyTime: JsonItem['applyTime']): string {
        if (typeof applyTime === 'string') {
            return applyTime.split('–')[1]?.trim() || '';
        }
        return applyTime?.to || '';
    }

    private detectPromoType(item: JsonItem): string {
        const ruleType = (item.ruleType || '').toLowerCase();
        if (ruleType === 'percentage') return 'percent';
        if (ruleType === 'fixed') return 'amount';

        const sourceText = `${item.label || ''} ${item.details || ''} ${item.ruleType || ''}`.toLowerCase();
        if (sourceText.includes('%')) return 'percent';
        if (sourceText.includes('điểm')) return 'point';
        if (sourceText.includes('combo')) return 'combo';
        if (sourceText.includes('hoàn tiền')) return 'refund';
        if (sourceText.includes('miễn phí')) return 'freeship';
        return 'amount';
    }

    private getPromoStatus(item: JsonItem, endDate: string): 'active' | 'upcoming' | 'expired' | 'draft' {
        if ((item as any).status === 'draft') {
            return 'draft';
        }

        const now = new Date();
        const fromDate = this.parseDate(item.startDate || this.getApplyFrom(item.applyTime));
        const toDate = this.parseDate(item.endDate || endDate);

        if (fromDate && fromDate > now) {
            return 'upcoming';
        }
        if (toDate && toDate < now) {
            return 'expired';
        }
        return 'active';
    }

    private parseDate(input: string): Date | null {
        if (!input) return null;
        const d = new Date(input);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    private buildPromoDisplayName(baseName: string, item: JsonItem, type: string): string {
        const cleaned = (baseName || '').replace(/\*\*/g, '').trim();
        const genericPattern = /^giảm\s*[\d.,]+\s*(k|vnd|đ|%)$/i;

        if (cleaned && !genericPattern.test(cleaned)) {
            return cleaned;
        }

        const target = this.formatApplyTarget(item.customerTargetType || item.target || 'all');
        const discount = this.formatDiscountValue(type, item.discountValueRaw ?? null);
        const detail = (item.details || '').trim();

        if (detail) {
            return detail.length > 70 ? `${detail.slice(0, 67)}...` : detail;
        }

        if (discount !== 'N/A') {
            return `Ưu đãi ${target} - ${discount}`;
        }

        return `Ưu đãi ${target}`;
    }

    private buildPromotionPayload(status: 'active' | 'draft'): PromotionApiModel {
        const fallbackDate = new Date().toISOString().slice(0, 10);
        const fromDate = this.currentPromotion.startDate || fallbackDate;
        const toDate = this.isLimitedTime ? (this.currentPromotion.endDate || '') : '';

        return {
            title: this.currentPromotion.promoName,
            icon: 'promo-default.png',
            category: this.currentPromotion.promoType,
            isFeatured: this.currentPromotion.isFeatured,
            items: [
                {
                    image: 'promo-default.png',
                    label: this.currentPromotion.promoName,
                    date: fromDate,
                    details: this.currentPromotion.descriptionPlaceholder || this.currentPromotion.notes || '',
                    isFeatured: this.currentPromotion.isFeatured,
                    startDate: fromDate,
                    endDate: toDate,
                    target: this.currentPromotion.customerTargetType,
                    applyTime: {
                        from: fromDate,
                        to: toDate
                    },
                    promoCode: this.currentPromotion.promoCode,
                    maxDiscountAmount: this.currentPromotion.maxDiscountAmount,
                    discountValueRaw: this.currentPromotion.discountValue,
                    status,
                    flightRoutes: this.currentPromotion.flightRoutes,
                    ticketClass: this.currentPromotion.ticketClass,
                    minTickets: this.currentPromotion.minTickets,
                    ruleType: this.currentPromotion.ruleType,
                    additionalCondition: this.currentPromotion.additionalCondition,
                    departureAirport: this.currentPromotion.departureAirport,
                    arrivalAirport: this.currentPromotion.arrivalAirport,
                    minOrderValue: this.currentPromotion.minOrderValue,
                    territory: this.currentPromotion.territory,
                    applyCountType: this.currentPromotion.applyCountType,
                    applyChannel: this.currentPromotion.applyChannel,
                    customerTargetType: this.currentPromotion.customerTargetType
                }
            ]
        };
    }
}