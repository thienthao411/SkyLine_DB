import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckTicket2 } from './checkticket2';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject } from 'rxjs';

describe('CheckTicket2', () => {
  let component: CheckTicket2;
  let fixture: ComponentFixture<CheckTicket2>;
  let mockRouter: any;
  let queryParamsSubject: Subject<any>;
  
  // Dữ liệu vé mẫu để sử dụng trong test
  const mockTicket = { 
    code: 'TRPM01', 
    name: 'Nguyễn Văn A', 
    seat: 'A15', 
    status: 'Đã thanh toán', 
    route: 'Hà Nội - TP. Hồ Chí Minh', 
    phone: '0901234567', 
    email: 'nguyenvana@example.com', 
    departure: '08:00 - 2025-12-25',
    price: 1500000 
  };

  // Mock ActivatedRoute để giả lập queryParams
  const mockActivatedRoute = {
    queryParams: of({ code: 'TRPM01' }) // Giá trị mặc định khi khởi tạo
  };

  beforeEach(async () => {
    // Khởi tạo Subject để kiểm soát queryParams một cách linh hoạt
    queryParamsSubject = new Subject<any>();
    
    mockRouter = {
      navigate: jasmine.createSpy('navigate')
    };

    await TestBed.configureTestingModule({
      // Vì CheckTicket2 là Standalone Component, ta import nó
      imports: [CheckTicket2, RouterTestingModule.withRoutes([])],
      providers: [
        // Thay thế ActivatedRoute bằng mock object
        { 
          provide: ActivatedRoute, 
          useValue: { 
            queryParams: queryParamsSubject.asObservable() 
          } 
        },
        // Thay thế Router bằng mock object để theo dõi navigate
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckTicket2);
    component = fixture.componentInstance;
    // Bắt đầu test bằng cách gửi code hợp lệ
    queryParamsSubject.next({ code: mockTicket.code });
    fixture.detectChanges(); // Gọi ngOnInit và cập nhật view
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------------------------------------------------
  // TEST LOGIC (Lấy dữ liệu từ Query Params)
  // -------------------------------------------------------------------

  it('should load ticket detail based on "code" query param', () => {
    // Component đã được khởi tạo với code: TRPM01, nên nó phải tìm thấy vé
    expect(component.ticketDetail).toBeDefined();
    expect(component.ticketDetail?.code).toBe(mockTicket.code);
    expect(component.ticketDetail?.name).toBe(mockTicket.name);
  });

  it('should show "not found" message if code is invalid or not found', () => {
    // Tái tạo lại component với mã vé không tồn tại
    queryParamsSubject.next({ code: 'INVALID_CODE' });
    fixture.detectChanges();

    expect(component.ticketDetail).toBeUndefined();
    
    const notFoundElement = fixture.nativeElement.querySelector('.not-found');
    expect(notFoundElement).toBeTruthy();
    expect(notFoundElement.textContent).toContain('Không tìm thấy thông tin vé.');
  });
  
  // -------------------------------------------------------------------
  // TEST CHỨC NĂNG (goBack)
  // -------------------------------------------------------------------

  it('should navigate back to /checkticket when goBack() is called', () => {
    // Arrange: Mock Router đã được thiết lập

    // Act
    component.goBack();

    // Assert
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/checkticket']);
  });
  
  // -------------------------------------------------------------------
  // TEST VIEW (Hiển thị)
  // -------------------------------------------------------------------
  
  it('should display "Đã thanh toán" status in green', () => {
    queryParamsSubject.next({ code: 'TRPM01' });
    fixture.detectChanges();

    const statusElement: HTMLElement = fixture.nativeElement.querySelector('.status-value');
    expect(statusElement.textContent?.trim()).toBe('Đã thanh toán');
    expect(statusElement.classList).toContain('paid');
  });
  
  it('should display "Chờ thanh toán" status in red and show payment button', () => {
    // Gửi mã vé có trạng thái "Chờ thanh toán" (TRPM02)
    queryParamsSubject.next({ code: 'TRPM02' });
    fixture.detectChanges();

    const statusElement: HTMLElement = fixture.nativeElement.querySelector('.status-value');
    expect(statusElement.textContent?.trim()).toBe('Chờ thanh toán');
    expect(statusElement.classList).toContain('unpaid');
    
    const payButton = fixture.nativeElement.querySelector('.btn-primary');
    expect(payButton).toBeTruthy();
    expect(payButton.textContent?.trim()).toBe('THANH TOÁN NGAY');
  });

});