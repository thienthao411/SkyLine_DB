import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
import { BookingService } from '../services/booking.service';
import { forkJoin } from 'rxjs';
import { BaggageOption, BookingApiService, Flight } from '../services/booking-api.service';

@Component({
  selector: 'app-baggage-selection',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './baggage-selection.html',
  styleUrls: ['./baggage-selection.css']
})
export class BaggageSelection implements OnInit {

  passengerForm: FormGroup;

  baggageOptions: BaggageOption[] = [];
  selectedBaggage = signal<BaggageOption | null>(null);

  isLoading = signal(true);
  selectedFlight = signal<Flight | null>(null);
  currentUser: UserWithoutPassword | null = null;

  selectedFlightId: string | null = null;
  selectedSeat: string | null = null;
  selectedSeatType: string | null = null;


  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private bookingService: BookingService,
    private bookingApiService: BookingApiService
  ) {

    this.passengerForm = this.fb.group({
      salutation: ['Quý Ông', Validators.required],
      fullName: ['', Validators.required],
      dob: ['', Validators.required],
      idNumber: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const savedFlightId = this.bookingService.getData('flight')?.flightId || this.bookingService.getData('selectedFlight')?.flightId;
    const savedSeat = this.bookingService.getData('selectedSeat');
    const savedSeatType = this.bookingService.getData('selectedSeatType');
    const savedPassengerInfo = this.bookingService.getData('passengerInfo');
    const savedBaggageCode = this.bookingService.getData('baggageOption')?.code;

    this.selectedFlightId = this.route.snapshot.queryParams['flightId'];
    this.selectedSeat = this.route.snapshot.queryParams['seat'];
    this.selectedSeatType = this.route.snapshot.queryParams['type'];
    this.currentUser = this.authService.getCurrentUser();

    this.selectedFlightId = this.selectedFlightId || savedFlightId || null;
    this.selectedSeat = this.selectedSeat || savedSeat || null;
    this.selectedSeatType = this.selectedSeatType || savedSeatType || null;

    if (!this.selectedFlightId || !this.selectedSeat) {
      alert('Thiếu dữ liệu đặt chỗ. Vui lòng chọn ghế lại từ đầu.');
      this.router.navigate(['/tim-chuyen-bay']);
      return;
    }

    let fullUserData: any = null;
    const fullUserRaw = localStorage.getItem('fullUserData');
    if (fullUserRaw) {
      fullUserData = JSON.parse(fullUserRaw);
    }

    if (this.currentUser) {
      this.passengerForm.patchValue({
        fullName: this.currentUser.name,
        email: this.currentUser.email
      });
    }

    if (fullUserData) {
      this.passengerForm.patchValue({
        phoneNumber: fullUserData.phone || '',
        dob: this.formatDateForInput(fullUserData.birthday),
        idNumber: fullUserData.passport || '',
        address: fullUserData.address || '',
        salutation: fullUserData.gender === 'Nữ' ? 'Quý Bà' : 'Quý Ông'
      });
    }

    if (savedPassengerInfo) {
      this.passengerForm.patchValue(savedPassengerInfo);
    }

    forkJoin({
      flight: this.bookingApiService.getFlightById(this.selectedFlightId),
      options: this.bookingApiService.getBaggageOptions()
    }).subscribe({
      next: ({ flight, options }) => {
        this.selectedFlight.set(flight);
        this.baggageOptions = options;
        if (savedBaggageCode) {
          const matchedOption = options.find((option) => option.code === savedBaggageCode) || null;
          this.selectedBaggage.set(matchedOption);
        }
        this.bookingService.setData('flight', flight);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu hành lý/chuyến bay:', err);
        this.isLoading.set(false);
      }
    });
  }

  private formatDateForInput(dateStr: string): string {
    if (!dateStr || dateStr.split('/').length !== 3) {
      return '';
    }
    const parts = dateStr.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }


  get f() {
    return this.passengerForm.controls;
  }

  selectBaggage(option: BaggageOption | null): void {
    if (this.selectedBaggage() === option) {
      this.selectedBaggage.set(null);
    } else {
      this.selectedBaggage.set(option);
    }
  }

  onSubmit(): void {
    if (this.passengerForm.valid) {
      console.log('Dữ liệu biểu mẫu:', this.passengerForm.value);

      const selectedBaggage = this.selectedBaggage();
      const selectedBaggagePrice = selectedBaggage ? selectedBaggage.price : 0;
      console.log('Giá hành lý đã chọn:', selectedBaggagePrice);

      this.bookingService.setData('passengerInfo', this.passengerForm.value);
      this.bookingService.setData('baggagePrice', selectedBaggagePrice);
      this.bookingService.setData('baggageOption', selectedBaggage);
      this.bookingService.setData('selectedFlight', this.selectedFlight());
      this.bookingService.setData('selectedSeat', this.selectedSeat);
      this.bookingService.setData('selectedSeatType', this.selectedSeatType);

      this.router.navigate(['/confirmation']);

    } else {
      this.passengerForm.markAllAsTouched();
      console.error('Form không hợp lệ.');
    }
  }

  quayLai(): void {
    if (this.selectedFlightId) {
      this.router.navigate(['/seat-selection', this.selectedFlightId]);
    } else {
      this.router.navigate(['/tim-chuyen-bay']);
    }
  }
  timeHM(iso?: string) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return ''; }
  }

  dateVN(iso?: string) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const wd = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][d.getDay()];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${wd}, ${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }
}