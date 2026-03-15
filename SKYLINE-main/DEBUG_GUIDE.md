# 🔍 Hướng dẫn Debug Trang Information

## ✅ Cập nhật mới nhất:
- Đã thêm nút "🔄 Tải lại dữ liệu" ở cuối form
- Nút này sẽ force reload dữ liệu từ file `user_data.json`
- Hiển thị thông báo chi tiết khi reload thành công

---

## 🎯 CÁCH KIỂM TRA:

### Bước 1: Mở trang Information
```
URL: http://localhost:4200/information
```

### Bước 2: Mở Developer Console
- Nhấn **F12** (hoặc Ctrl+Shift+I)
- Chọn tab **Console**

### Bước 3: Click nút "🔄 Tải lại dữ liệu"
- Nút nằm ở cuối form, bên cạnh nút "Chỉnh sửa thông tin"
- Click vào nút

### Bước 4: Kiểm tra kết quả

#### ✅ Nếu thành công:
Bạn sẽ thấy:
1. **Alert popup** hiển thị:
   ```
   ✅ Đã tải lại dữ liệu thành công!
   
   Họ tên: Nguyễn Văn An
   Email: nguyenvana@gmail.com
   Điện thoại: 0912345678
   Ngày sinh: 12/04/1995
   Passport: 079123451
   ```

2. **Console logs**:
   ```
   🔄 Reloading user data from JSON file...
   🔍 Looking for user: nguyenvana@gmail.com
   📦 Loaded 7 users from JSON
   ✅ Reloaded user data: {fullName: "Nguyễn Văn An", email: "nguyenvana@gmail.com", ...}
   ```

3. **Form được cập nhật** với tất cả thông tin:
   - ✅ Số điện thoại: 0912345678
   - ✅ Ngày sinh: 12/04/1995
   - ✅ CMND/Passport: 079123451
   - ✅ Ngày hết hạn: 10/02/2030
   - ✅ Địa chỉ: 25 Nguyễn Trãi, Q1, TP.HCM

---

## 🔧 NẾU VẪN KHÔNG HIỂN thị:

### Option A: Clear localStorage và đăng nhập lại

1. Mở Console (F12), chạy lệnh:
```javascript
localStorage.clear();
location.reload();
```

2. Đăng nhập lại:
```
Email: nguyenvana@gmail.com
Password: admin123
```

3. Vào trang Information → Dữ liệu sẽ được load tự động

---

### Option B: Debug trong Console

1. Kiểm tra localStorage hiện tại:
```javascript
console.log('fullUserData:', JSON.parse(localStorage.getItem('fullUserData')));
console.log('currentUser:', JSON.parse(localStorage.getItem('currentUser')));
```

2. Force reload data bằng code:
```javascript
// Mở trang Information, rồi chạy:
const component = window['ng'] ? window['ng'].getComponent(document.querySelector('app-information')) : null;
if (component) {
  component.reloadUserData();
}
```

---

## 📋 DANH SÁCH TÀI KHOẢN TEST:

### Tài khoản 1: Nguyễn Văn An
```
Email: nguyenvana@gmail.com
Password: admin123
```
**Dữ liệu mong đợi:**
- Họ tên: Nguyễn Văn An
- Điện thoại: 0912345678
- Ngày sinh: 12/04/1995
- Giới tính: Nam
- Passport: 079123451
- Hết hạn: 10/02/2030
- Địa chỉ: 25 Nguyễn Trãi, Q1, TP.HCM

### Tài khoản 2: Trần Thị Bích
```
Email: tranthib@gmail.com
Password: admin123
```
**Dữ liệu mong đợi:**
- Họ tên: Trần Thị Bích
- Điện thoại: 0978123456
- Ngày sinh: 23/09/1998
- Giới tính: Nữ
- Passport: 079123452
- Hết hạn: 03/06/2030
- Địa chỉ: 98 Lý Thường Kiệt, Q10, TP.HCM

### Tài khoản 3: Lê Hoài Thành
```
Email: lehoaithanh@gmail.com
Password: admin123
```
**Dữ liệu mong đợi:**
- Họ tên: Lê Hoài Thành
- Điện thoại: 0905456789
- Ngày sinh: 30/07/1992
- Giới tính: Nam
- Passport: 079123453
- Hết hạn: 01/01/2031
- Địa chỉ: 12 Võ Văn Ngân, TP.Thủ Đức, TP.HCM

---

## 🐛 TROUBLESHOOTING:

### Lỗi: "Không tìm thấy thông tin"
**Nguyên nhân:** Email trong localStorage không khớp với email trong JSON
**Giải pháp:** Clear localStorage và đăng nhập lại

### Lỗi: "Lỗi khi tải file JSON"
**Nguyên nhân:** File `user_data.json` không tồn tại hoặc bị lỗi cú pháp
**Giải pháp:** Kiểm tra file tại `src/assets/data/user_data.json`

### Form vẫn trống sau khi reload
**Nguyên nhân:** Angular change detection chưa chạy
**Giải pháp:** Click nút một lần nữa hoặc F5 reload page

---

## 📞 Support:
Nếu vẫn gặp vấn đề, gửi screenshot của:
1. Console logs (F12 → Console tab)
2. Form hiện tại (trang Information)
3. localStorage data (chạy lệnh debug ở trên)
