import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private bookingData: any = {};

  constructor() {
    // Khi khởi tạo, thử load dữ liệu từ localStorage để giữ khi reload
    const saved = localStorage.getItem('bookingData');
    if (saved) {
      this.bookingData = JSON.parse(saved);
    }
  }

  // Lưu thông tin
  setData(key: string, value: any) {
    this.bookingData[key] = value;
    this.persist(); // lưu xuống localStorage ngay
  }

  // Lấy thông tin, nếu chưa có thì trả về null
  getData(key: string) {
    return this.bookingData[key] ?? null;
  }

  // Lấy tất cả dữ liệu
  getAllData() {
    return { ...this.bookingData };
  }

  // Xóa dữ liệu
  clearData() {
    this.bookingData = {};
    localStorage.removeItem('bookingData');
  }

  // Lưu xuống localStorage
  private persist() {
    localStorage.setItem('bookingData', JSON.stringify(this.bookingData));
  }
}
