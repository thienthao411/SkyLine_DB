import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { HeaderComponent } from '../shared/header/header';



@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, RouterOutlet, Sidebar, HeaderComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {

}
