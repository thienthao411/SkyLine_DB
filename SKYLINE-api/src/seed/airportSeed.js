require('dotenv').config();
const mongoose = require('mongoose');
const Airport = require('../models/Airport');

const airports = [
  { code: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', province: 'Ho Chi Minh', country: 'Vietnam', displayName: 'SGN - Tan Son Nhat - Ho Chi Minh City', isActive: true },
  { code: 'HAN', name: 'Noi Bai International Airport', city: 'Ha Noi', province: 'Ha Noi', country: 'Vietnam', displayName: 'HAN - Noi Bai - Ha Noi', isActive: true },
  { code: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', province: 'Da Nang', country: 'Vietnam', displayName: 'DAD - Da Nang - Da Nang', isActive: true },
  { code: 'CXR', name: 'Cam Ranh International Airport', city: 'Nha Trang', province: 'Khanh Hoa', country: 'Vietnam', displayName: 'CXR - Cam Ranh - Nha Trang', isActive: true },
  { code: 'HPH', name: 'Cat Bi International Airport', city: 'Hai Phong', province: 'Hai Phong', country: 'Vietnam', displayName: 'HPH - Cat Bi - Hai Phong', isActive: true },
  { code: 'VCA', name: 'Can Tho International Airport', city: 'Can Tho', province: 'Can Tho', country: 'Vietnam', displayName: 'VCA - Can Tho - Can Tho', isActive: true },
  { code: 'PQC', name: 'Phu Quoc International Airport', city: 'Phu Quoc', province: 'Kien Giang', country: 'Vietnam', displayName: 'PQC - Phu Quoc - Kien Giang', isActive: true },
  { code: 'HUI', name: 'Phu Bai International Airport', city: 'Hue', province: 'Thua Thien Hue', country: 'Vietnam', displayName: 'HUI - Phu Bai - Hue', isActive: true },
  { code: 'VII', name: 'Tan Son Nhat Domestic Terminal', city: 'Ho Chi Minh City', province: 'Ho Chi Minh', country: 'Vietnam', displayName: 'VII - Tan Son Nhat Domestic - Ho Chi Minh City', isActive: true },
  { code: 'THD', name: 'Tho Xuan Airport', city: 'Thanh Hoa', province: 'Thanh Hoa', country: 'Vietnam', displayName: 'THD - Tho Xuan - Thanh Hoa', isActive: true }
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding airports');

  await Airport.deleteMany({ code: { $in: airports.map(a => a.code) } });
  await Airport.insertMany(airports);
  console.log('Seeded airports:', airports.map(a => a.code).join(', '));
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
