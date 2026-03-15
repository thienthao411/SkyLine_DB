import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HeaderComponent } from '../shared/header/header';
import { FooterComponent } from '../shared/footer/footer';

interface Review {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  review: string;
  date: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, HeaderComponent, FooterComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  reviews: Review[] = [];
  displayedReviews: Review[] = [];
  reviewsToShow: number = 3;

  // Flight search data
  cities = [
    { code: 'HAN', name: 'HAN (Hà Nội, Việt Nam)' },
    { code: 'SGN', name: 'SGN (TP. Hồ Chí Minh, Việt Nam)' },
    { code: 'DAD', name: 'DAD (Đà Nẵng, Việt Nam)' },
    { code: 'CXR', name: 'CXR (Nha Trang, Việt Nam)' },
    { code: 'PQC', name: 'PQC (Phú Quốc, Việt Nam)' }
  ];

  departureCity: string = '';
  arrivalCity: string = '';
  travelDate: string = '';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Load reviews from JSON
    this.loadReviews();
  }

  // Get available arrival cities (excluding selected departure)
  getAvailableArrivalCities() {
    return this.cities.filter(city => city.code !== this.departureCity);
  }

  // Get available departure cities (excluding selected arrival)
  getAvailableDepartureCities() {
    return this.cities.filter(city => city.code !== this.arrivalCity);
  }

  // Handle departure change
  onDepartureChange() {
    // If arrival city is the same as new departure, clear arrival
    if (this.arrivalCity === this.departureCity) {
      this.arrivalCity = '';
    }
  }

  // Handle arrival change
  onArrivalChange() {
    // If departure city is the same as new arrival, clear departure
    if (this.departureCity === this.arrivalCity) {
      this.departureCity = '';
    }
  }

  // Handle search
  onSearch() {
    if (this.departureCity && this.arrivalCity && this.travelDate) {
      // console.log('Searching flights:', {
      //   from: this.departureCity,
      //   to: this.arrivalCity,
      //   date: this.travelDate
      // });
      // Navigate to flight search results
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