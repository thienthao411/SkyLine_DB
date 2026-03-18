# Flight Search API Design

## 1. Hiện trạng trang tìm chuyến bay đang GET như thế nào

### 1.1 Trang `tim-chuyen-bay` chưa gọi backend

Frontend hiện tại không gọi `GET /api/flights` của BE. Thay vào đó, trang tìm chuyến bay đang đọc trực tiếp file JSON tĩnh:

- File: `SKYLINE-main/src/app/user/flight-search/flight-search.ts`
- Đoạn chính: `fetchData()` dùng `this.http.get('assets/data/flight-search-sampledata.json')`

Luồng hiện tại:

1. Khi component khởi tạo, nó đọc `history.state.search` và `query params`.
2. Sau đó gọi `fetchData(true)` để tải toàn bộ danh sách chuyến bay từ file `assets/data/flight-search-sampledata.json`.
3. Sau khi tải xong, frontend tự lọc toàn bộ dữ liệu ngay trên client.

Điểm quan trọng:

- `search()` không bắn request mới lên server.
- `search()` chỉ cập nhật state và query params URL.
- Kết quả outbound/inbound được tính bằng `computed()` từ `allFlights()`.

### 1.2 Dữ liệu được lọc ở client

Trang tìm chuyến bay hiện lọc local theo:

- `from`
- `to`
- `date`
- `returnDate` cho khứ hồi
- hãng bay
- khoảng giá
- khung giờ cất cánh
- thời lượng bay
- sort giá tăng/giảm

Ngoài ra có một logic đặc biệt:

- Nếu không có chuyến đúng ngày, frontend tự tìm ngày gần nhất và tự đổi `departDate` hoặc `returnDate`.

### 1.3 Query param đang được ghi lên URL

Sau khi bấm tìm, frontend chỉ ghi các giá trị sau lên URL:

- `trip`
- `from`
- `to`
- `date`

Các filter khác như:

- `returnDate`
- `airlineSel`
- `priceSel`
- `timeSel`
- `durSel`
- `sortOrder`

không được đưa lên query string, mà chỉ giữ trong state nội bộ hoặc `history.state`.

### 1.4 Trang chi tiết chuyến bay cũng đang GET file local

Trang `chon-chuyen-bay/:id` hiện cũng không gọi BE. Nó lại đọc:

- `assets/data/flight-search-sampledata.json`

rồi tìm flight theo `id`.

### 1.5 Trang chọn ghế đã kỳ vọng API thật

`BookingApiService` ở frontend đã chuẩn bị sẵn các API sau:

- `GET /api/flights/:id`
- `GET /api/flights/:id/seats`

Tức là luồng booking phía sau đã có kỳ vọng dùng backend thật, nhưng riêng search page và detail page hiện vẫn đang dùng JSON local.

## 2. Khoảng cách với backend hiện tại

Backend hiện có:

- `GET /api/flights`
- `POST /api/flights`
- `PUT /api/flights/:id`
- `DELETE /api/flights/:id`

Nhưng `GET /api/flights` hiện chỉ là:

- `Flight.find()`
- không có filter
- không có phân trang
- không có sort theo search use case
- không có endpoint lấy chi tiết theo `id`
- không có endpoint lấy ghế đã đặt

Ngoài ra schema BE hiện tại cũng khác format mà frontend search đang dùng:

- BE có `priceEconomy`, `priceBusiness`
- FE đang mong `price`
- BE có `seatsBookedBusiness`, `seatsBookedEconomy`, `seatsBookedTotal`
- FE đang mong `seatsLeft`
- FE còn dùng `details`, `fromAirport`, `toAirport`

Nói ngắn gọn: search page hiện chưa nối với BE, và shape dữ liệu giữa FE search với model BE chưa khớp hoàn toàn.

## 3. Cách mình thiết kế API cho luồng này

### 3.1 Nguyên tắc thiết kế

Mình chọn thiết kế theo hướng:

- một endpoint search cho 1 chặng
- frontend gọi 1 lần cho one-way
- frontend gọi 2 lần cho round-trip

Lý do:

- đơn giản hơn cho backend
- dễ cache
- dễ debug
- bám sát UI hiện tại vì outbound và return đang được render thành 2 danh sách riêng
- không cần một endpoint quá phức tạp cho cả khứ hồi

## 4. API đề xuất

### 4.1 `GET /api/flights/search`

Mục tiêu:

- trả về danh sách chuyến bay đã được filter theo đúng nhu cầu của trang tìm chuyến bay

Query params đề xuất:

| Param | Bắt buộc | Mô tả |
| --- | --- | --- |
| `from` | yes | Mã sân bay đi, ví dụ `SGN` |
| `to` | yes | Mã sân bay đến, ví dụ `DAD` |
| `date` | yes | Ngày bay dạng `YYYY-MM-DD` |
| `cabin` | no | `Economy` hoặc `Business` |
| `adults` | no | Số người lớn |
| `children` | no | Số trẻ em |
| `infants` | no | Số em bé |
| `airlines` | no | Danh sách hãng, ví dụ `Vietnam Airlines,Vietjet` |
| `priceMin` | no | Giá nhỏ nhất |
| `priceMax` | no | Giá lớn nhất |
| `timeRanges` | no | Ví dụ `morning,noon,evening` |
| `durationBuckets` | no | Ví dụ `u60,60_120,o120` |
| `sort` | no | `price_asc`, `price_desc`, `depart_asc`, `depart_desc` |
| `page` | no | Trang hiện tại |
| `limit` | no | Số bản ghi mỗi trang |
| `fallbackNearestDate` | no | `true/false`, cho phép trả ngày gần nhất nếu ngày yêu cầu không có chuyến |

Ví dụ request:

```http
GET /api/flights/search?from=SGN&to=DAD&date=2025-11-15&cabin=Economy&sort=price_asc&page=1&limit=20
```

Ví dụ request có filter:

```http
GET /api/flights/search?from=SGN&to=DAD&date=2025-11-15&airlines=Vietnam%20Airlines,Vietjet&timeRanges=morning,noon&durationBuckets=60_120&sort=price_asc
```

Response đề xuất:

```json
{
  "success": true,
  "criteria": {
    "from": "SGN",
    "to": "DAD",
    "date": "2025-11-15",
    "cabin": "Economy",
    "sort": "price_asc",
    "fallbackNearestDate": false
  },
  "data": [
    {
      "id": "67d6d2c9f7d8c4b1c2a12345",
      "flightId": "VN101-2025-11-15-SGN-DAD",
      "airline": "Vietnam Airlines",
      "airlineCode": "VN",
      "flightNo": "VN101",
      "from": "SGN",
      "to": "DAD",
      "fromAirport": "Sân bay Tân Sơn Nhất",
      "toAirport": "Sân bay Đà Nẵng",
      "date": "2025-11-15",
      "departTime": "2025-11-15T15:00:00+07:00",
      "arriveTime": "2025-11-15T16:25:00+07:00",
      "durationMin": 85,
      "currency": "VND",
      "cabin": "Economy",
      "price": 1902000,
      "seatsLeft": 9,
      "details": {
        "stops": 0,
        "stopsLabel": "Bay thẳng"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "hasMore": false,
    "resolvedDate": "2025-11-15",
    "fallbackUsed": false
  }
}
```

### 4.2 `GET /api/flights/:id`

Mục tiêu:

- phục vụ trang `chon-chuyen-bay/:id`
- trả chi tiết 1 chuyến bay theo id

Ví dụ response:

```json
{
  "success": true,
  "flight": {
    "id": "67d6d2c9f7d8c4b1c2a12345",
    "flightId": "VN101-2025-11-15-SGN-DAD",
    "airline": "Vietnam Airlines",
    "airlineCode": "VN",
    "flightNo": "VN101",
    "from": "SGN",
    "to": "DAD",
    "fromAirport": "Sân bay Tân Sơn Nhất",
    "toAirport": "Sân bay Đà Nẵng",
    "date": "2025-11-15",
    "departTime": "2025-11-15T15:00:00+07:00",
    "arriveTime": "2025-11-15T16:25:00+07:00",
    "durationMin": 85,
    "currency": "VND",
    "price": 1902000,
    "cabin": "Economy",
    "seatsLeft": 9,
    "details": {
      "stops": 0,
      "stopsLabel": "Bay thẳng",
      "perks": ["7kg xách tay", "Chọn chỗ tiêu chuẩn"],
      "fareOptions": [],
      "terminalFrom": null,
      "terminalTo": null,
      "gate": null,
      "aircraft": "A321"
    }
  }
}
```

### 4.3 `GET /api/flights/:id/seats`

Mục tiêu:

- phục vụ trang chọn ghế
- trả về danh sách ghế đã bị giữ/đã đặt

Ví dụ response:

```json
{
  "success": true,
  "flightId": "67d6d2c9f7d8c4b1c2a12345",
  "occupiedSeats": ["A01", "A02", "C07"]
}
```

### 4.4 `GET /api/flights`

Endpoint cũ nên giữ lại cho admin hoặc internal list, nhưng không nên dùng trực tiếp cho trang search customer.

Lý do:

- trả cả bảng dữ liệu sẽ nặng
- frontend phải lọc local
- khó scale khi số lượng chuyến bay tăng

## 5. Mapping dữ liệu từ model BE sang DTO cho FE

Model hiện tại ở BE:

- `priceEconomy`
- `priceBusiness`
- `seatsEconomyMax`
- `seatsBusinessMax`
- `seatsBookedEconomy`
- `seatsBookedBusiness`
- `stops`
- `stopsLabel`

DTO mình đề xuất cho FE:

| FE field | Cách map từ BE |
| --- | --- |
| `id` | dùng `_id` hoặc `flightId` nhưng nên thống nhất `_id` cho route detail |
| `flightId` | lấy từ `flightId` nếu muốn có business id |
| `price` | nếu `cabin=Business` thì lấy `priceBusiness`, ngược lại lấy `priceEconomy` |
| `seatsLeft` | nếu `cabin=Business` thì `seatsBusinessMax - seatsBookedBusiness`, ngược lại `seatsEconomyMax - seatsBookedEconomy` |
| `fromAirport` | map từ `fromAirportName` |
| `toAirport` | map từ `toAirportName` |
| `details.stops` | map từ `stops` |
| `details.stopsLabel` | map từ `stopsLabel` |

## 6. Cách FE nên gọi API sau khi nối thật

### 6.1 One-way

Trang `tim-chuyen-bay` gọi:

```http
GET /api/flights/search?from=SGN&to=DAD&date=2025-11-15&cabin=Economy&sort=price_asc
```

Backend trả danh sách đã lọc sẵn.

### 6.2 Round-trip

Frontend gọi 2 request độc lập:

Chặng đi:

```http
GET /api/flights/search?from=SGN&to=DAD&date=2025-11-15&cabin=Economy&sort=price_asc
```

Chặng về:

```http
GET /api/flights/search?from=DAD&to=SGN&date=2025-11-20&cabin=Economy&sort=price_asc
```

Ưu điểm:

- đúng với UI hiện tại
- dễ retry từng chặng
- dễ hiển thị lỗi riêng cho outbound hoặc inbound

### 6.3 Trang chi tiết chuyến bay

Thay vì đọc lại file JSON local, trang `chon-chuyen-bay/:id` nên gọi:

```http
GET /api/flights/:id
```

### 6.4 Trang chọn ghế

Giữ nguyên đúng hướng mà `BookingApiService` đang mong đợi:

```http
GET /api/flights/:id
GET /api/flights/:id/seats
```

## 7. Ghi chú implementation

### 7.1 Nên chuyển logic "ngày gần nhất" về backend

Hiện tại frontend đang tự tìm ngày gần nhất nếu không có chuyến đúng ngày. Theo mình nên chuyển logic này vào backend bằng cờ:

- `fallbackNearestDate=true`

Khi đó backend trả thêm:

- `meta.resolvedDate`
- `meta.fallbackUsed`

Frontend chỉ việc hiển thị thông báo.

### 7.2 Có một mismatch nhỏ ở UI hiện tại

Trang tìm chuyến bay có state:

- `cabinOut`
- `cabinBack`

nhưng logic filter hiện tại chưa dùng hai giá trị này để lọc kết quả. Nếu nối API thật, nên quyết định rõ:

- hoặc cabin là tham số search thật
- hoặc bỏ filter cabin khỏi UI nếu chưa dùng

### 7.3 Nên tách DTO response khỏi Mongo model

Không nên trả raw document từ `Flight.find()` thẳng cho frontend. Nên có một lớp mapper để:

- giữ API ổn định
- không làm FE phụ thuộc chặt vào schema Mongo
- dễ đổi schema sau này

## 8. Kết luận

Hiện tại trang tìm chuyến bay đang GET dữ liệu từ file JSON local và lọc hoàn toàn ở client, chưa dùng backend thật. Thiết kế phù hợp nhất cho luồng hiện tại là:

1. `GET /api/flights/search` cho search theo từng chặng
2. `GET /api/flights/:id` cho trang chi tiết chuyến bay
3. `GET /api/flights/:id/seats` cho trang chọn ghế

Thiết kế này khớp với UI hiện tại, ít phải đổi frontend nhất, và cũng nối được mượt với `BookingApiService` đã có sẵn.
