import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AirlineManagement } from './airline-management';

describe('AirlineManagement', () => {
  let component: AirlineManagement;
  let fixture: ComponentFixture<AirlineManagement>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirlineManagement],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AirlineManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpTestingController.expectOne('http://localhost:5000/api/airlines');
    req.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
