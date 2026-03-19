import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, UserWithoutPassword } from '../services/auth.service';
import { TicketService } from '../services/ticket.service';
import { catchError, forkJoin, of } from 'rxjs';
import { BaggageOption, TicketApiService, Flight } from '../services/ticket-api.service';

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
    private ticketService: TicketService,
    private ticketApiService: TicketApiService
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
    const savedFlight = this.ticketService.getData<{ id?: string; flightId?: string }>('flight');
    const savedSelectedFlight = this.ticketService.getData<{ id?: string; flightId?: string }>('selectedFlight');
    const flightFallback = (savedFlight || savedSelectedFlight || null) as Flight | null;
    const savedFlightId = savedFlight?.flightId || savedFlight?.id || savedSelectedFlight?.flightId || savedSelectedFlight?.id;
    const savedSeat = this.ticketService.getData<string>('selectedSeat') || this.ticketService.getData<string>('seat');
    const savedSeatType = this.ticketService.getData<string>('selectedSeatType');
    const savedPassengerInfo = this.ticketService.getData<Record<string, unknown>>('passengerInfo');
    const savedBaggageCode = this.ticketService.getData<{ code?: string }>('baggageOption')?.code;

    this.selectedFlightId =
      this.route.snapshot.queryParamMap.get('flightId') ||
      this.route.snapshot.paramMap.get('id') ||
      savedFlightId ||
      null;
    this.selectedSeat =
      this.route.snapshot.queryParamMap.get('seat') ||
      savedSeat ||
      null;
    this.selectedSeatType =
      this.route.snapshot.queryParamMap.get('type') ||
      savedSeatType ||
      null;
    this.currentUser = this.authService.getCurrentUser();

    if (flightFallback) {
      this.selectedFlight.set(flightFallback);
    }

    if (!this.selectedFlightId || !this.selectedSeat) {
      alert('Thiếu dữ liệu đặt chỗ. Vui lòng chọn ghế lại từ đầu.');
      this.router.navigate(['/tim-chuyen-bay']);
      return;
    }

    let fullUserData: any = null;
    const fullUserRaw = localStorage.getItem('fullUserData');
    if (fullUserRaw) {
      try {
        fullUserData = JSON.parse(fullUserRaw);
      } catch {
        fullUserData = null;
      }
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
      flight: this.ticketApiService.getFlightById(this.selectedFlightId).pipe(
        catchError((error) => {
          console.error('Lỗi tải chi tiết chuyến bay:', error);
          return of(flightFallback);
        })
      ),
      options: this.ticketApiService.getBaggageOptions().pipe(
        catchError((error) => {
          console.error('Lỗi tải danh sách hành lý:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ flight, options }) => {
        this.selectedFlight.set(flight ?? flightFallback);

        this.baggageOptions = this.normalizeBaggageOptions(options);

        if (savedBaggageCode) {
          const matchedOption = this.baggageOptions.find((option) => option.code === savedBaggageCode) || null;
          this.selectedBaggage.set(matchedOption);
        }
        if (flight) {
          this.ticketService.setData('flight', flight);
        }
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

      this.ticketService.setData('passengerInfo', this.passengerForm.value);
      this.ticketService.setData('baggagePrice', selectedBaggagePrice);
      this.ticketService.setData('baggageOption', selectedBaggage);
      this.ticketService.setData('selectedFlight', this.selectedFlight());
      this.ticketService.setData('selectedSeat', this.selectedSeat);
      this.ticketService.setData('selectedSeatType', this.selectedSeatType);

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
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd} Thg ${mm}`;
    } catch { return ''; }
  }

  private normalizeBaggageOptions(options: BaggageOption[]): BaggageOption[] {
    const source = Array.isArray(options) ? options : [];
    return source
      .filter((option) => !!option)
      .map((option) => {
        const safePrice = Number.isFinite(Number(option.price)) ? Number(option.price) : 0;
        return {
          ...option,
          price: safePrice,
          priceDisplay: option.priceDisplay || `${safePrice.toLocaleString('vi-VN')}đ`,
        };
      });
  }
}

