import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Confirmation } from './confirmation';
import { provideRouter } from '@angular/router';

describe('Confirmation', () => {
  let component: Confirmation;
  let fixture: ComponentFixture<Confirmation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Confirmation], providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Confirmation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
