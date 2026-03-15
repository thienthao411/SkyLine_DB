import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable } from 'rxjs'; 

// Cần đảm bảo các imports này được xử lý trong module cha (nếu không phải standalone)
import { AdminSidebarComponent } from '../shared/sidebar/sidebar';
import { AdminHeader } from '../shared/header/admin-header/admin-header';

// --- INTERFACES ---
interface Promotion {
  promoId: string;
  promoName: string;
  promoCode: string;
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
  target: string;
  applyTime: string;
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
  id: string;
  title: string;
  icon: string;
  items: JsonItem[];
  visibleCount: number;
  expanded: boolean;
}

interface PromoListItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
  applyTarget: string;
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

  searchTerm: string = '';
  selectedStatusFilter: string = 'all';
  selectedTypeFilter: string = 'all';
  isLimitedTime: boolean = false;
  isFormInvalid: boolean = true;
  isDraftInvalid: boolean = true;
  showModalType: 'cancel' | 'draft' | 'activate' | 'view' | null = null; 
  
  promoToView: PromoListItem | null = null; 
  rawJsonData: PromoCategory[] = []; 
  
  currentPromotion: Promotion = {
      promoId: '', promoName: '', promoCode: '', promoType: 'percent', discountValue: null,
      maxDiscountAmount: null, startDate: '', endDate: '', status: 'inactive', notes: '',
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
      { value: 'point', label: 'Thưởng điểm' },
      { value: 'combo', label: 'Combo/Dịch vụ' },
      { value: 'refund', label: 'Hoàn tiền' },
  ];

  constructor(private http: HttpClient) { }
  
  ngOnInit(): void {
      this.loadPromoData(); 
      this.updateFormValidity();
  }
  
  // 🟢 HÀM TRẢ VỀ MÔ TẢ THÂN THIỆN CHO BẢNG
  getPromoTypeLabel(typeCode: string): string {
      return this.promoTypeDescriptions[typeCode as keyof typeof this.promoTypeDescriptions] || this.promoTypeDescriptions['default'];
  }

  loadPromoData() {
      const jsonPath = 'assets/data/promotion.json';
      this.http.get<PromoCategory[]>(jsonPath).subscribe({
          next: (data) => {
              this.rawJsonData = data; 
              
              let promoIdCounter = 1;
              const flattenedPromos: PromoListItem[] = [];
              
              data.forEach(category => {
                  category.items.forEach((item, index) => {
                      const parts = item.details.replace(/\*\*/g, '').split(',');
                      const name = parts[0]?.trim() || item.date;
                      
                      // 🟢 LOGIC XÁC ĐỊNH TYPE CODE
                      let typeCode = 'amount';
                      if (item.details.includes('%')) typeCode = 'percent';
                      else if (item.details.includes('điểm')) typeCode = 'point';
                      else if (item.details.includes('Combo')) typeCode = 'combo';
                      else if (item.details.includes('Hoàn tiền')) typeCode = 'refund';
                      else if (item.details.includes('Miễn phí')) typeCode = 'freeship';

                      let status: 'active' | 'upcoming' | 'expired' | 'draft' = 'active';
                      if (item.applyTime.includes('Vô thời hạn') || item.date.includes('Sale Tết')) {
                           status = 'upcoming';
                      }
                      if (item.applyTime.split('–')[1]?.trim() && new Date(item.applyTime.split('–')[1]?.trim()) < new Date()) {
                           status = 'expired';
                      }
                      
                      flattenedPromos.push({
                          id: promoIdCounter++,
                          name: name, 
                          startDate: item.applyTime.split('–')[0]?.trim() || '', 
                          endDate: item.applyTime.split('–')[1]?.trim() || 'Vô thời hạn', 
                          type: typeCode, // 🟢 SỬ DỤNG MÃ CODE
                          applyTarget: item.target,
                          status: status,
                          jsonCategoryId: category.id, 
                          jsonItemIndex: index 
                      });
                  });
              });
              
              this.promos = flattenedPromos;

          },
          error: (err) => {
              console.error("Lỗi khi tải dữ liệu khuyến mãi từ JSON:", err);
          }
      });
  }

  getPromoRawData(): JsonItem | null {
    if (!this.promoToView || !this.rawJsonData) return null;

    // 🟢 1. XỬ LÝ CHƯƠNG TRÌNH ĐƯỢC TẠO MỚI GIẢ
    if (this.promoToView.jsonCategoryId === 'user_added_temp') {
        // Trả về dữ liệu chi tiết (Giả định chi tiết khớp với PromoListItem)
        return {
            image: 'assets/img/default_promo.jpg', // Dùng ảnh placeholder
            label: this.promoToView.name,
            date: this.promoToView.startDate,
            details: `Chi tiết cho chương trình mới: ${this.promoToView.name}.`,
            target: this.promoToView.applyTarget,
            applyTime: `${this.promoToView.startDate} – ${this.promoToView.endDate}`,
            promoCode: 'NEW_CODE',
            maxDiscountAmount: 0,
            // Thêm các trường khác để Modal không bị lỗi (chúng ta chỉ dùng item cơ bản)
        } as JsonItem; 
    }
    
    // 2. XỬ LÝ DỮ LIỆU JSON GỐC
    const category = this.rawJsonData.find(c => c.id === this.promoToView!.jsonCategoryId);
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
          
          // Lấy giá trị số đã làm sạch từ rawData (FIX LỖI)
          let discountValue = rawData?.discountValueRaw || 0;

          this.currentPromotion = {
              ...this.currentPromotion,
              promoName: promoItem.name.replace(/\*\*/g, '').trim(), 
              promoCode: rawData?.promoCode || `CODE-${promoItem.id}`, 
              
              // 🟢 FIX: Ánh xạ promoType là MÃ CODE và discountValue là GIÁ TRỊ SỐ
              promoType: promoItem.type, // Là mã code: 'percent', 'combo', etc.
              discountValue: discountValue,
              
              maxDiscountAmount: rawData?.maxDiscountAmount || null,
              startDate: promoItem.startDate,
              endDate: promoItem.endDate !== 'Vô thời hạn' ? promoItem.endDate : '',
              status: promoItem.status === 'active' || promoItem.status === 'upcoming' ? 'active' : 'inactive',
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
        promoId: '', promoName: '', promoCode: '', promoType: 'percent', discountValue: null,
        maxDiscountAmount: null, startDate: '', endDate: '', status: 'inactive', notes: '',
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

        if (term) {
            result = result.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.applyTarget.toLowerCase().includes(term) ||
                p.type.toLowerCase().includes(term)
            );
        }

        return result;
    }

    deletePromo(id: number) {
        if (confirm(`Bạn có chắc chắn muốn xóa khuyến mãi ID ${id} không?`)) {
            this.promos = this.promos.filter(p => p.id !== id);
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
          this.activeMainTab = 'manage';
          this.activeStep = 'info';
          this.isLimitedTime = false;
      } else if (this.showModalType === 'draft' || this.showModalType === 'activate') {
          
          // 🟢 1. TẠO DỮ LIỆU MỚI (Mapping Promotion -> PromoListItem)
          const newPromoId = Math.max(...this.promos.map(p => p.id), 0) + 1;
          
          const newPromoItem: PromoListItem = {
              id: newPromoId,
              name: this.currentPromotion.promoName,
              startDate: this.currentPromotion.startDate,
              endDate: this.isLimitedTime ? this.currentPromotion.endDate : 'Vô thời hạn',
              type: this.currentPromotion.promoType,
              applyTarget: this.currentPromotion.customerTargetType,
              status: this.showModalType === 'activate' ? 'active' : 'draft', 
              
              // 🟢 SỬA: Đặt khóa tạm thời để hàm getPromoRawData nhận diện
              jsonCategoryId: 'user_added_temp', 
              jsonItemIndex: 0, 
          };
  
          // 🟢 2. THÊM DỮ LIỆU MỚI VÀO BẢNG
          this.promos = [newPromoItem, ...this.promos]; 
          
          console.log('Đã thêm chương trình mới:', newPromoItem);
          alert(`Đã ${this.showModalType === 'activate' ? 'Lưu & Kích hoạt' : 'Lưu bản nháp'} chương trình thành công!`);
          this.activeMainTab = 'manage';
          this.currentPromotion = this.createEmptyPromotion();
          this.isLimitedTime = false;
      }
      this.closeModal();
    }

    saveAndContinue() {
        if (this.isFormInvalid) {
            alert('Vui lòng điền Tên, Mã và Giá trị giảm (nếu có) trước khi tiếp tục.');
            return;
        }
        this.switchStep('apply');
    }
}