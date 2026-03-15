import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightManagement } from './flight-management';

describe('FlightManagement', () => {
  let component: FlightManagement;
  let fixture: ComponentFixture<FlightManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlightManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
