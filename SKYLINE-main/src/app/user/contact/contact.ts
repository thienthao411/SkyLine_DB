import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  submitted = false;

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitted = true;

    // Hiện thông báo 3 giây rồi ẩn
    setTimeout(() => {
      this.submitted = false;
    }, 3000);
  }
}