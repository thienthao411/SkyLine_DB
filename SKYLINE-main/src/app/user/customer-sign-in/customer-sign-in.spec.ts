import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerSignIn } from './customer-sign-in';

describe('CustomerSignIn', () => {
  let component: CustomerSignIn;
  let fixture: ComponentFixture<CustomerSignIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerSignIn]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerSignIn);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
