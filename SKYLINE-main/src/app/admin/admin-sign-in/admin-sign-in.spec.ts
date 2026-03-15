import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminSignIn } from './admin-sign-in';

describe('AdminSignIn', () => {
  let component: AdminSignIn;
  let fixture: ComponentFixture<AdminSignIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSignIn]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminSignIn);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
