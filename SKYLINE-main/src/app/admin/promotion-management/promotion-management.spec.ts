import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromotionManagement } from './promotion-management';

describe('PromotionManagement', () => {
  let component: PromotionManagement;
  let fixture: ComponentFixture<PromotionManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromotionManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromotionManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
