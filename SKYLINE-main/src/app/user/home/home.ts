import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';
import { PromotionListComponent } from './components/promotion-list/promotion-list';
import { FeaturedPromotionItem, PromotionApiService } from '../../services/promotion-api.service';
import { AirlineApiModel, AirlineApiService } from '../../services/airline-api.service';
import { AirportApiService, Airport } from '../../services/airport-api.service';

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

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, HeaderComponent, FooterComponent, PromotionListComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  reviews: Review[] = [];
  displayedReviews: Review[] = [];
  reviewsToShow: number = 3;
  featuredPromotions: FeaturedPromotionItem[] = [];
  isLoadingFeaturedPromotions = true;
  airlines: AirlinePartner[] = [];
  isLoadingAirlines = true;

  // Flight search data
  airports: Airport[] = [];
  departureSuggestions: Airport[] = [];
  arrivalSuggestions: Airport[] = [];
  showDepartureSuggestions = false;
  showArrivalSuggestions = false;
  departureQuery = '';
  arrivalQuery = '';

  departureCity: string = '';
  arrivalCity: string = '';
  travelDate: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private promotionApi: PromotionApiService,
    private airlineApi: AirlineApiService,
    private airportApi: AirportApiService
  ) {}

  ngOnInit(): void {
    // Load reviews from JSON
    this.loadReviews();
    this.loadFeaturedPromotions();
    this.loadAirlines();
    this.loadAirports();
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

  // Handle search
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

    if (this.departureCity && this.arrivalCity && this.travelDate) {
      this.router.navigate(['/tim-chuyen-bay'], {
      queryParams: {
        from: this.departureCity.toUpperCase(),
        to: this.arrivalCity.toUpperCase(),
        date: this.travelDate,}
    });
    }
  }

  loadReviews(): void {
    this.http.get<{ reviews: Review[] }>('assets/data/reviews.json')
      .subscribe({
        next: (data) => {
          this.reviews = data.reviews;
          // Display only first 3 reviews initially
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
}