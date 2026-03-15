import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rewards } from './rewards';

describe('Rewards', () => {
  let component: Rewards;
  let fixture: ComponentFixture<Rewards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rewards]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Rewards);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
