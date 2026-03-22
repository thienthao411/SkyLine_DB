import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { PromotionListComponent } from './components/promotion-list/promotion-list';
import { FeaturedPromotionItem, PromotionApiService } from '../../services/promotion-api.service';
import { AirlineApiModel, AirlineApiService } from '../../services/airline-api.service';
import { AirportApiService, Airport } from '../../services/airport-api.service';
import { AiChatApiService } from '../services/ai-chat-api.service';

interface Review {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  review: string;
  date: string;
}

interface AirlinePartner {
  id: string;
  name: string;
  hotline: string;
  logo: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, HeaderComponent, FooterComponent, PromotionListComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly aiSessionStorageKey = 'skyline_ai_chat_session_id';
  private readonly aiSuggestionStorageKey = 'skyline_ai_chat_show_suggestions';

  reviews: Review[] = [];
  displayedReviews: Review[] = [];
  reviewsToShow = 3;
  featuredPromotions: FeaturedPromotionItem[] = [];
  isLoadingFeaturedPromotions = true;
  airlines: AirlinePartner[] = [];
  isLoadingAirlines = true;

  airports: Airport[] = [];
  departureSuggestions: Airport[] = [];
  arrivalSuggestions: Airport[] = [];
  showDepartureSuggestions = false;
  showArrivalSuggestions = false;
  departureQuery = '';
  arrivalQuery = '';

  departureCity = '';
  arrivalCity = '';
  travelDate = '';

  isAiChatOpen = false;
  isAiTyping = false;
  showQuickQuestions = true;
  chatInput = '';
  aiSessionId = '';
  chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Xin chào. Mình là trợ lý AI của Skyline. Bạn có thể hỏi về chuyến bay, giá vé, cách đặt vé, đổi/hoàn vé hoặc khuyến mãi.',
      createdAt: new Date()
    }
  ];
  quickQuestions: string[] = [
    'Cách đặt vé máy bay?',
    'Làm sao tìm chuyến bay phù hợp?',
    'Tôi muốn tra cứu vé đã đặt',
    'Có khuyến mãi nào hiện tại không?'
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private promotionApi: PromotionApiService,
    private airlineApi: AirlineApiService,
    private airportApi: AirportApiService,
    private aiChatApi: AiChatApiService
  ) {}

  ngOnInit(): void {
    this.loadReviews();
    this.loadFeaturedPromotions();
    this.loadAirlines();
    this.loadAirports();
    this.restoreAiSessionId();
    this.restoreSuggestionPreference();
  }

  private restoreSuggestionPreference(): void {
    const stored = localStorage.getItem(this.aiSuggestionStorageKey);
    if (stored === null) {
      this.showQuickQuestions = true;
      return;
    }
    this.showQuickQuestions = stored !== 'false';
  }

  private persistSuggestionPreference(): void {
    localStorage.setItem(this.aiSuggestionStorageKey, this.showQuickQuestions ? 'true' : 'false');
  }

  private restoreAiSessionId(): void {
    const stored = localStorage.getItem(this.aiSessionStorageKey);
    this.aiSessionId = String(stored || '').trim();
  }

  private persistAiSessionId(sessionId: string): void {
    const value = String(sessionId || '').trim();
    if (!value) return;
    this.aiSessionId = value;
    localStorage.setItem(this.aiSessionStorageKey, value);
  }

  loadAirports(): void {
    this.airportApi.getAllAirports().subscribe({
      next: (airports) => {
        this.airports = airports || [];
      },
      error: (error) => {
        console.error('Error loading airports:', error);
        this.airports = [];
      }
    });
  }

  loadAirlines(): void {
    this.isLoadingAirlines = true;

    this.airlineApi.getAll().subscribe({
      next: (airlines) => {
        this.airlines = airlines
          .filter((item) => {
            const status = (item.status ?? '').trim().toLowerCase();
            return status === '' || status === 'đang hợp tác' || status === 'active';
          })
          .map((item, index) => this.toAirlinePartner(item, index));
        this.isLoadingAirlines = false;
      },
      error: (error) => {
        console.error('Error loading airlines:', error);
        this.airlines = [];
        this.isLoadingAirlines = false;
      }
    });
  }

  private toAirlinePartner(item: AirlineApiModel, index: number): AirlinePartner {
    return {
      id: item._id ?? `${item.airlineCode ?? 'airline'}-${index}`,
      name: item.airlineName?.trim() || item.airlineCode?.trim() || 'Hang hang khong',
      hotline: item.hotline?.trim() || 'Dang cap nhat',
      logo: item.img?.trim() || item.logo?.trim() || 'assets/images/VietnamAirlines.jpg'
    };
  }

  loadFeaturedPromotions(): void {
    this.isLoadingFeaturedPromotions = true;

    this.promotionApi.getFeatured({ limit: 3, sortBy: 'newest' }).subscribe({
      next: (promotions) => {
        this.featuredPromotions = promotions;
        this.isLoadingFeaturedPromotions = false;
      },
      error: (error) => {
        console.error('Error loading featured promotions:', error);
        this.featuredPromotions = [];
        this.isLoadingFeaturedPromotions = false;
      }
    });
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  private airportText(airport: Airport): string {
    return [
      airport.code,
      airport.icao,
      airport.name,
      airport.city,
      airport.province,
      airport.displayName
    ].filter(Boolean).join(' ');
  }

  private filterAirports(query: string, excludedCode = ''): Airport[] {
    const normalizedQuery = this.normalizeText(query);
    const excluded = String(excludedCode || '').toUpperCase();

    return this.airports
      .filter((airport) => {
        const code = String(airport.code || '').toUpperCase();
        if (!code || code === excluded) return false;

        if (!normalizedQuery) return true;
        return this.normalizeText(this.airportText(airport)).includes(normalizedQuery);
      })
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  }

  private formatAirportLabel(airport: Airport): string {
    return `${airport.code} - ${airport.name}`;
  }

  private resolveAirportFromInput(input: string, excludedCode = ''): Airport | null {
    const value = String(input || '').trim();
    const excluded = String(excludedCode || '').toUpperCase();

    if (!value) return null;

    const upperValue = value.toUpperCase();
    const byCode = this.airports.find((airport) =>
      String(airport.code || '').toUpperCase() === upperValue && String(airport.code || '').toUpperCase() !== excluded
    );
    if (byCode) return byCode;

    const normalizedValue = this.normalizeText(value);
    const byName = this.airports.find((airport) => {
      const code = String(airport.code || '').toUpperCase();
      if (!code || code === excluded) return false;
      return this.normalizeText(this.airportText(airport)).includes(normalizedValue);
    });

    return byName || null;
  }

  onDepartureInput(value: string): void {
    this.departureQuery = value;
    this.departureCity = '';
    this.showDepartureSuggestions = true;
    this.departureSuggestions = this.filterAirports(value, this.arrivalCity);
  }

  onArrivalInput(value: string): void {
    this.arrivalQuery = value;
    this.arrivalCity = '';
    this.showArrivalSuggestions = true;
    this.arrivalSuggestions = this.filterAirports(value, this.departureCity);
  }

  onDepartureFocus(): void {
    this.showDepartureSuggestions = true;
    this.departureSuggestions = this.filterAirports(this.departureQuery, this.arrivalCity);
  }

  onArrivalFocus(): void {
    this.showArrivalSuggestions = true;
    this.arrivalSuggestions = this.filterAirports(this.arrivalQuery, this.departureCity);
  }

  onDepartureBlur(): void {
    setTimeout(() => {
      this.showDepartureSuggestions = false;
    }, 120);
  }

  onArrivalBlur(): void {
    setTimeout(() => {
      this.showArrivalSuggestions = false;
    }, 120);
  }

  selectDepartureAirport(airport: Airport): void {
    this.departureCity = String(airport.code || '').toUpperCase();
    this.departureQuery = this.formatAirportLabel(airport);
    this.showDepartureSuggestions = false;
    this.departureSuggestions = [];

    if (this.arrivalCity === this.departureCity) {
      this.arrivalCity = '';
      this.arrivalQuery = '';
    }
  }

  selectArrivalAirport(airport: Airport): void {
    this.arrivalCity = String(airport.code || '').toUpperCase();
    this.arrivalQuery = this.formatAirportLabel(airport);
    this.showArrivalSuggestions = false;
    this.arrivalSuggestions = [];

    if (this.departureCity === this.arrivalCity) {
      this.departureCity = '';
      this.departureQuery = '';
    }
  }

  onSearch(): void {
    if (!this.departureCity) {
      const resolvedDeparture = this.resolveAirportFromInput(this.departureQuery, this.arrivalCity);
      if (resolvedDeparture) {
        this.selectDepartureAirport(resolvedDeparture);
      }
    }

    if (!this.arrivalCity) {
      const resolvedArrival = this.resolveAirportFromInput(this.arrivalQuery, this.departureCity);
      if (resolvedArrival) {
        this.selectArrivalAirport(resolvedArrival);
      }
    }

    const normalizedTravelDate = this.normalizeTravelDate(this.travelDate);

    if (this.departureCity && this.arrivalCity && normalizedTravelDate) {
      this.router.navigate(['/tim-chuyen-bay'], {
        queryParams: {
          from: this.departureCity.toUpperCase(),
          to: this.arrivalCity.toUpperCase(),
          date: normalizedTravelDate,
        }
      });
    }
  }

  private normalizeTravelDate(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    // Already ISO format from other screens: yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    // Home search accepts dd/mm/yyyy and converts it to ISO.
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const candidate = new Date(year, month - 1, day);

    const isValidDate =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;

    if (!isValidDate) return '';

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  loadReviews(): void {
    this.http.get<{ reviews: Review[] }>('assets/data/reviews.json')
      .subscribe({
        next: (data) => {
          this.reviews = data.reviews;
          this.displayedReviews = this.reviews.slice(0, this.reviewsToShow);
        },
        error: (error) => {
          console.error('Error loading reviews:', error);
        }
      });
  }

  loadMoreReviews(): void {
    this.reviewsToShow += 3;
    this.displayedReviews = this.reviews.slice(0, this.reviewsToShow);
  }

  collapseReviews(): void {
    this.reviewsToShow = 3;
    this.displayedReviews = this.reviews.slice(0, this.reviewsToShow);
  }

  hasMoreReviews(): boolean {
    return this.displayedReviews.length < this.reviews.length;
  }

  canCollapse(): boolean {
    return this.displayedReviews.length > 3;
  }

  getStars(rating: number): string {
    return '⭐'.repeat(rating);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  toggleAiChat(): void {
    this.isAiChatOpen = !this.isAiChatOpen;
  }

  askQuickQuestion(question: string): void {
    this.chatInput = question;
    this.sendChatMessage();
  }

  toggleQuickQuestions(): void {
    this.showQuickQuestions = !this.showQuickQuestions;
    this.persistSuggestionPreference();
  }

  sendChatMessage(): void {
    const question = this.chatInput.trim();
    if (!question || this.isAiTyping) {
      return;
    }

    this.chatMessages.push({
      role: 'user',
      content: question,
      createdAt: new Date()
    });
    this.chatInput = '';
    this.isAiTyping = true;

    this.aiChatApi.sendMessage({
      message: question,
      sessionId: this.aiSessionId,
    }).subscribe({
      next: (response) => {
        this.persistAiSessionId(response.sessionId);
        const assistantReply = String(response.reply || '').trim() || this.generateAiReply(question);
        this.chatMessages.push({
          role: 'assistant',
          content: assistantReply,
          createdAt: new Date()
        });
        this.isAiTyping = false;
      },
      error: () => {
        const fallbackResponse = this.generateAiReply(question);
        this.chatMessages.push({
          role: 'assistant',
          content: fallbackResponse,
          createdAt: new Date()
        });
        this.isAiTyping = false;
      }
    });
  }

  clearChatContext(): void {
    this.chatMessages = [
      {
        role: 'assistant',
        content: 'Đã bắt đầu đoạn chat mới. Bạn có thể đặt câu hỏi mới về chuyến bay, giá vé, đặt vé hoặc tra cứu vé.',
        createdAt: new Date()
      }
    ];
    this.aiSessionId = '';
    localStorage.removeItem(this.aiSessionStorageKey);
  }

  private generateAiReply(message: string): string {
    const normalized = this.normalizeText(message);

    if (normalized.includes('dat ve') || normalized.includes('mua ve')) {
      return [
        'Bạn có thể đặt vé nhanh theo 4 bước:',
        '1) Tại trang chủ, nhập điểm đi, điểm đến và ngày bay rồi bấm "Tìm kiếm".',
        '2) Tại trang Tìm chuyến bay, chọn chuyến phù hợp.',
        '3) Điền thông tin hành khách, chọn hành lý/ghế (nếu cần).',
        '4) Thanh toán và nhận mã vé điện tử.',
        'Mẹo: Nên đặt sớm 2-4 tuần để có giá tốt hơn.'
      ].join('\n');
    }

    if (normalized.includes('tim chuyen bay') || normalized.includes('chuyen bay')) {
      if (this.airports.length > 0) {
        const topAirports = this.airports
          .filter((airport) => String(airport.code || '').trim())
          .slice(0, 6)
          .map((airport) => `${airport.code} - ${airport.name}`)
          .join(', ');

        return [
          'Bạn có thể tìm chuyến bay ngay trên form ở đầu trang chủ.',
          'Nhập mã sân bay (ví dụ: SGN, HAN, DAD) hoặc tên sân bay, chọn ngày bay và bấm "Tìm kiếm".',
          `Gợi ý một số sân bay phổ biến: ${topAirports}.`,
          'Sau đó hệ thống sẽ chuyển sang trang kết quả để bạn lọc và chọn chuyến phù hợp.'
        ].join('\n');
      }

      return 'Bạn chỉ cần nhập điểm đi, điểm đến và ngày bay ở form tìm kiếm trên trang chủ, sau đó bấm "Tìm kiếm" để xem danh sách chuyến bay.';
    }

    if (normalized.includes('gia ve') || normalized.includes('bao nhieu tien') || normalized.includes('chi phi')) {
      return [
        'Giá vé thay đổi theo hành trình, ngày bay, hãng bay và thời điểm đặt.',
        'Để xem giá chính xác, bạn vui lòng tìm chuyến bay theo ngày cụ thể.',
        'Mẹo tiết kiệm: linh hoạt ngày bay, đặt sớm và theo dõi mục Khuyến mãi để có giá tốt hơn.'
      ].join('\n');
    }

    if (normalized.includes('tra cuu ve') || normalized.includes('ma ve') || normalized.includes('kiem tra ve')) {
      return [
        'Bạn có thể tra cứu vé tại mục "Tra cứu vé".',
        'Chỉ cần nhập mã vé hoặc thông tin liên quan để xem trạng thái thanh toán và chi tiết hành trình.',
        'Nếu cần đổi/hoàn vé, hãy vào chi tiết vé để xem tùy chọn khả dụng.'
      ].join('\n');
    }

    if (normalized.includes('doi ve') || normalized.includes('hoan ve') || normalized.includes('huy ve')) {
      return [
        'Đổi/hoàn vé phụ thuộc vào điều kiện của hãng bay và hạng vé đã đặt.',
        'Bạn hãy vào "Tra cứu vé" để mở chi tiết vé, sau đó chọn thao tác đổi/hủy nếu được hỗ trợ.',
        'Nếu không thấy tùy chọn, bạn nên liên hệ bộ phận hỗ trợ để được xử lý nhanh.'
      ].join('\n');
    }

    if (normalized.includes('khuyen mai') || normalized.includes('ma giam') || normalized.includes('uu dai')) {
      return [
        'Bạn có thể xem ưu đãi mới nhất ở mục "Khuyến mãi" ngay trên thanh điều hướng.',
        'Khi thanh toán, hãy nhập mã giảm giá (nếu có) để áp dụng ưu đãi.',
        'Nên kiểm tra điều kiện sử dụng mã: thời gian, hành trình và giá trị đơn hàng tối thiểu.'
      ].join('\n');
    }

    if (normalized.includes('lien he') || normalized.includes('ho tro') || normalized.includes('tong dai')) {
      return [
        'Bạn có thể gửi yêu cầu ở trang "Liên hệ" nếu cần hỗ trợ.',
        'Skyline hỗ trợ các vấn đề phổ biến: đặt vé, thanh toán, thay đổi hành trình, hành lý và thông tin vé.'
      ].join('\n');
    }

    return [
      'Mình có thể hỗ trợ bạn về:',
      '- Tìm chuyến bay và đặt vé',
      '- Tra cứu, đổi/hoàn vé',
      '- Khuyến mãi và hướng dẫn thanh toán',
      'Bạn muốn mình hướng dẫn mục nào trước?'
    ].join('\n');
  }
}
