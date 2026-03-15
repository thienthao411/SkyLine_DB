import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';

interface Deal {
  image: string;
  label: string;
  date: string;
  details: string;
  target: string;
  applyTime: string;
  promoCode: string;
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
  imports: [CommonModule, FormsModule, HeaderComponent, FooterComponent], 
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

  ngOnInit(): void { 
    this.loadPromotions();
  }

  // Tải dữ liệu từ file JSON 
  async loadPromotions() {
    try {
      const response = await fetch('assets/data/promotion.json');
      const data: Section[] = await response.json();
      
      this.sections = data.map(section => ({
        ...section,
        visibleCount: 3,
        expanded: false
      }));

      this.applyFilter(); // Vẫn gọi lần đầu để hiện thị toàn bộ data
    } catch (error) {
      console.error('Lỗi khi tải khuyến mãi từ JSON:', error);
    }
  }

  // HÀM LỌC CHỈ CHẠY KHI BẤM ICON HOẶC ENTER
  applyFilter(): void {
    if (!this.sections || this.sections.length === 0) {
        this.filteredSections = [];
        return;
    }

    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
        // Nếu không có từ khóa, hiển thị toàn bộ sections
        this.filteredSections = this.sections.map(section => ({
            ...section,
            visibleCount: 3, 
            expanded: false
        }));
        return;
    }

    // Lọc theo từ khóa
    this.filteredSections = this.sections.map(section => {
        const filteredItems = section.items.filter(item => {
            // Kiểm tra từ khóa trong label, details, và promoCode
            return item.label.toLowerCase().includes(term) ||
                   item.details.toLowerCase().includes(term) ||
                   item.promoCode.toLowerCase().includes(term);
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

  closePopup() {
    this.selectedDeal = null;
  }
}