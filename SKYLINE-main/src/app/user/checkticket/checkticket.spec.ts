import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { CheckTicket } from './checkticket';

describe('CheckTicket', () => {
  let component: CheckTicket;
  let fixture: ComponentFixture<CheckTicket>;
  let router: Router;

  it('should call searchTicket on Enter key press in input field', () => {
    spyOn(component, 'searchTicket');
    const inputElement: HTMLInputElement = fixture.nativeElement.querySelector('input');
    
    const enterEvent = new KeyboardEvent('keyup', {
      key: 'Enter',
      keyCode: 13,
      code: 'Enter',
    } as KeyboardEventInit);

    inputElement.dispatchEvent(enterEvent);
    fixture.detectChanges();

    expect(component.searchTicket).toHaveBeenCalled();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckTicket, FormsModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(CheckTicket);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter tickets by code', () => {
    component.searchText = 'TRPM01';
    component.searchTicket();
    expect(component.filteredTickets.length).toBe(1);
    expect(component.filteredTickets[0].code).toBe('TRPM01');
  });

  it('should filter tickets by seat', () => {
    component.searchText = 'A16';
    component.searchTicket();
    expect(component.filteredTickets.length).toBe(1);
    expect(component.filteredTickets[0].seat).toBe('A16');
  });

  it('should show all tickets when search text is empty', () => {
    component.searchText = '';
    component.searchTicket();
    expect(component.filteredTickets.length).toBe(component.tickets.length);
  });

  it('should call goToDetail', () => {
    const ticket = component.tickets[0];
    let hrefValue = '';
    Object.defineProperty(window.location, 'href', {
      set: (val) => { hrefValue = val; },
      configurable: true
    });
    component.goToDetail(ticket);
    expect(hrefValue).toContain('checkticket2.html');
  });

  it('should call goHome', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.goHome();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
