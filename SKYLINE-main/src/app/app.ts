import { Component, signal } from '@angular/core';
import { Routes } from '@angular/router';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Confirmation } from './user/confirmation/confirmation';
import { CheckTicket } from './user/checkticket/checkticket';
import { CheckTicket2 } from './user/checkticket2/checkticket2';
import { SeatSelection } from './user/seat-selection/seat-selection';
import { BaggageSelection } from './user/baggage-selection/baggage-selection';
import { Checkout } from './user/checkout/checkout';
import { Sidebar } from './user/sidebar/sidebar';
import { Information } from './user/information/information';
import { Promotion } from './user/promotion/promotion';
import { Rewards } from './user/rewards/rewards';
import { Notifications } from './user/notifications/notifications';
import { Contact } from './user/contact/contact';
import { FlightSelection } from './user/flight-selection/flight-selection';
import { TicketManagement } from './admin/ticket-management/ticket-management';
import { FlightManagement } from './admin/flight-management/flight-management';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    FormsModule,
    SeatSelection,
    BaggageSelection,
    Checkout,
    Sidebar,
    Confirmation,
    Information,
    Promotion,
    Rewards,
    Notifications,
    Contact,
    FlightManagement,
    TicketManagement
  ],
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('skyline');

  constructor() {
  }
}

export const routes: Routes = [
  { path: '', redirectTo: 'checkticket', pathMatch: 'full' },
  { path: 'checkticket', component: CheckTicket },
  { path: 'checkticket2', component: CheckTicket2 },
  { path: 'flight-selection/:id', component: FlightSelection },
  { path: 'seat-selection/:flightId', component: SeatSelection },
  { path: 'baggage-selection', component: BaggageSelection },
  { path: 'checkout', component: Checkout },
  { path: 'confirmation', component: Confirmation },
  { path: 'information', component: Information },
  { path: 'promotion', component: Promotion },
  { path: 'rewards', component: Rewards },
  { path: 'notifications', component: Notifications },
  { path: 'contact', component: Contact }
];