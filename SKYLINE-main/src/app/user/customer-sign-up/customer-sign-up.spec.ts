import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerSignUp } from './customer-sign-up';

describe('CustomerSignUp', () => {
  let component: CustomerSignUp;
  let fixture: ComponentFixture<CustomerSignUp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerSignUp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerSignUp);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
