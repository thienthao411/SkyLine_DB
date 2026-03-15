import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketManagement } from './ticket-management';

describe('TicketManagement', () => {
  let component: TicketManagement;
  let fixture: ComponentFixture<TicketManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
