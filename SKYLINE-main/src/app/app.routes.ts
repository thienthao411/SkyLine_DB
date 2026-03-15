import { Routes } from '@angular/router';

// Layout & pages
import { MainLayout } from './user/main-layout/main-layout';
import { Information } from './user/information/information';
import { Rewards } from './user/rewards/rewards';
import { Notifications } from './user/notifications/notifications';
import { CheckTicket } from './user/checkticket/checkticket';
import { CheckTicket2 } from './user/checkticket2/checkticket2';
import { Confirmation } from './user/confirmation/confirmation';

// Booking pages
import { SeatSelection } from './user/seat-selection/seat-selection';
import { BaggageSelection } from './user/baggage-selection/baggage-selection';
import { Checkout } from './user/checkout/checkout';
import { Contact } from './user/contact/contact';

export const routes: Routes = [
  // Trang mặc định khi vào app
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Đăng nhập/đăng ký Customer
  {
    path: 'customer-sign-in',
    loadComponent: () => import('./user/customer-sign-in/customer-sign-in').then(m => m.CustomerSignInComponent)
  },
  {
    path: 'customer-sign-up',
    loadComponent: () => import('./user/customer-sign-up/customer-sign-up').then(m => m.CustomerSignUpComponent)
  },

  // Đăng nhập Admin
  {
    path: 'admin-login',
    loadComponent: () => import('./admin/admin-sign-in/admin-sign-in').then(m => m.AdminSignIn)
  },
  {
    path: 'admin-home',
    loadComponent: () => import('./admin/admin-home/admin-home').then(m => m.AdminHomeComponent)
  },

  // Admin Management Pages
  {
    path: 'admin/ticket-management',
    loadComponent: () => import('./admin/ticket-management/ticket-management').then(m => m.TicketManagement)
  },
  {
    path: 'admin/flight-management',
    loadComponent: () => import('./admin/flight-management/flight-management').then(m => m.FlightManagement)
  },
  {
    path: 'admin/airline-management',
    loadComponent: () => import('./admin/airline-management/airline-management').then(m => m.AirlineManagement)
  },
  {
    path: 'admin/promotion-management',
    loadComponent: () => import('./admin/promotion-management/promotion-management').then(m => m.PromotionManagement)
  },
  {
    path: 'admin/user-management',
    loadComponent: () => import('./admin/user-management/user-management').then(m => m.UserManagement)
  },

  // Trang chính
  {
    path: 'home',
    loadComponent: () => import('./user/home/home').then(m => m.Home)
  },

  {
    path: 'intro',
    loadComponent: () => import('./user/intro/intro').then(m => m.Intro)
  },

  {
    path: 'promotion',
    loadComponent: () => import('./user/promotion/promotion').then(m => m.Promotion)
  },

  // Các trang trong layout chính
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'information', component: Information },
      { path: 'rewards', component: Rewards },
      { path: 'notifications', component: Notifications },
      { path: 'checkticket', component: CheckTicket },
      { path: 'checkticket2', component: CheckTicket2 },
      { path: '', redirectTo: 'checkticket', pathMatch: 'full' },
      { path: 'contact', component: Contact },
      { path: '', redirectTo: 'checkticket', pathMatch: 'full' },
    ]
  },

  //Trang tìm chuyến bay
  {
    path: 'tim-chuyen-bay',
    loadComponent: () =>
      import('./user/flight-search/flight-search')
        .then(m => m.FlightSearchComponent),
  },

  //Trang chọn chuyến bay (Sửa đường dẫn import)
  {
    path: 'chon-chuyen-bay/:id',
    loadComponent: () =>
      import('./user/flight-selection/flight-selection') // <-- SỬA: Thêm .component
        .then(m => m.FlightSelectionComponent),
  },

  // Trang đặt vé / chuyến bay (SỬA LỖI CHÍNH)
  { path: 'seat-selection/:flightId', component: SeatSelection }, // <-- SỬA: Thêm :flightId
  { path: 'baggage-selection/:id', component: BaggageSelection },
  { path: 'baggage-selection', component: BaggageSelection },
  { path: 'checkout', component: Checkout },

  // Trang xác nhận
  { path: 'confirmation', component: Confirmation },
];