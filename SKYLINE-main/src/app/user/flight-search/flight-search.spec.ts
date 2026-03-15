/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FlightSearchComponent } from './flight-search';

describe('FlightSearchComponent (standalone)', () => {
  let component: FlightSearchComponent;
  let fixture: ComponentFixture<FlightSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightSearchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render basic UI pieces', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button.btn')?.textContent).toContain('Tìm chuyến bay');
    const tabs = el.querySelectorAll('.trip-tabs .tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
  });

  it('swap() should swap origin/destination codes', () => {
    component.from.set('SGN');
    component.to.set('HAN');

    component.swap();
    expect(component.from()).toBe('HAN');
    expect(component.to()).toBe('SGN');
  });

  it('should update DOM after swap button click', () => {
    const swapBtn = fixture.debugElement.query(By.css('.swap'));
    expect(swapBtn).toBeTruthy();

    component.from.set('SGN');
    component.to.set('DAD');
    fixture.detectChanges();

    swapBtn.triggerEventHandler('click', {});
    fixture.detectChanges();

    const selects = fixture.debugElement.queryAll(By.css('select'));
    const fromSelect = selects[0].nativeElement as HTMLSelectElement;
    const toSelect = selects[1].nativeElement as HTMLSelectElement;

    expect(component.from()).toBe('DAD');
    expect(component.to()).toBe('SGN');
  });
});
