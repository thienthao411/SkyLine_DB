import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirlineManagement} from './airline-management';

describe('AirlineManagement', () => {
  let component: AirlineManagement;
  let fixture: ComponentFixture<AirlineManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirlineManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AirlineManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
