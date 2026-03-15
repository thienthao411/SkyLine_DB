import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightSelectionComponent } from './flight-selection';

describe('FlightSelection', () => {
  let component: FlightSelectionComponent;
  let fixture: ComponentFixture<FlightSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightSelectionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(FlightSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
