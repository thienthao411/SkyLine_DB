import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaggageSelection } from './baggage-selection';

describe('BaggageSelection', () => {
  let component: BaggageSelection;
  let fixture: ComponentFixture<BaggageSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BaggageSelection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BaggageSelection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
