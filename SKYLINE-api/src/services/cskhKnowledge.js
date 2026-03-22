// Skyline CSKH Knowledge Base
// Cơ sở kiến thức về chính sách và hướng dẫn cho khách hàng

const POLICIES = {
  baggage: {
    carryOn: {
      economy: "Hành lý xách tay: 1 kiện tối đa 7kg, kích thước không quá 56x36x23cm",
      business: "Hành lý xách tay: 2 kiện, mỗi kiện tối đa 7kg"
    },
    checked: {
      economy: "Hành lý ký gửi: 20kg miễn phí cho hạng Phổ thông",
      business: "Hành lý ký gửi: 30-40kg miễn phí cho hạng Thương gia (tùy hãng)"
    },
    excess: "Phí hành lý quá cước: 50.000-100.000 VND/kg tùy hãng và hành trình",
    restricted: [
      "Chất lỏng trên 100ml phải ký gửi",
      "Pin dự phòng, thiết bị điện tử phải mang theo người",
      "Cấm mang chất dễ cháy nổ, vũ khí, ma túy"
    ]
  },

  checkIn: {
    online: {
      time: "24-1 giờ trước giờ bay",
      howTo: "Truy cập website hãng bay hoặc app di động, nhập mã đặt chỗ và họ tên",
      benefit: "Chọn chỗ ngồi miễn phí (nếu có), tiết kiệm thời gian tại sân bay"
    },
    airport: {
      domestic: "Có mặt tại sân bay trước 90-120 phút cho chuyến nội địa",
      international: "Có mặt tại sân bay trước 3 giờ cho chuyến quốc tế",
      deadline: "Quầy check-in đóng trước 40 phút (nội địa) hoặc 50 phút (quốc tế)"
    },
    documents: {
      domestic: "CMND/CCCD hoặc hộ chiếu còn hạn",
      international: "Hộ chiếu còn hạn tối thiểu 6 tháng, visa (nếu cần)"
    }
  },

  refundChange: {
    refund: {
      refundable: "Vé có hoàn: được hoàn 70-90% giá vé (trừ phí hoàn)",
      nonRefundable: "Vé không hoàn: không được hoàn tiền",
      fee: "Phí hoàn vé: 200.000-500.000 VND/vé tùy hãng và hạng vé",
      timeLimit: "Thời hạn hoàn vé: trước 24 giờ kể từ giờ bay",
      process: "Liên hệ hotline hoặc đại lý đã xuất vé để yêu cầu hoàn"
    },
    change: {
      allowed: "Đổi ngày bay, giờ bay, hành trình (tùy điều kiện vé)",
      fee: "Phí đổi vé: 300.000-700.000 VND/vé + chênh lệch giá vé (nếu có)",
      timeLimit: "Đổi vé trước 24 giờ kể từ giờ bay",
      process: "Liên hệ hotline hoặc đại lý, cung cấp mã vé và yêu cầu đổi"
    },
    nameChange: {
      allowed: "Chỉ sửa lỗi chính tả tên (tối đa 3 ký tự)",
      notAllowed: "Không được đổi tên sang người khác",
      fee: "Phí sửa tên: 100.000-300.000 VND"
    }
  },

  payment: {
    methods: [
      "Thẻ ATM nội địa (miễn phí)",
      "Thẻ tín dụng Visa/Mastercard (miễn phí)",
      "Ví điện tử Momo/ZaloPay (miễn phí hoặc phí 1-2%)",
      "Chuyển khoản ngân hàng (xác nhận trong 24h)"
    ],
    security: [
      "Thanh toán qua cổng bảo mật SSL 256-bit",
      "Không lưu thông tin thẻ",
      "Mã OTP xác nhận giao dịch"
    ],
    issues: {
      failed: "Nếu thanh toán thất bại, kiểm tra số dư, hạn mức, hoặc liên hệ ngân hàng",
      duplicate: "Nếu bị trừ tiền 2 lần, liên hệ CSKH với mã giao dịch để xử lý hoàn tiền",
      timeout: "Giao dịch timeout: kiểm tra lại đơn hàng, nếu chưa có vé thì đặt lại"
    }
  },

  booking: {
    steps: [
      "1. Tìm kiếm chuyến bay theo điểm đi, điểm đến, ngày bay",
      "2. Chọn chuyến bay phù hợp",
      "3. Điền đầy đủ thông tin hành khách (họ tên, ngày sinh, giới tính)",
      "4. Chọn dịch vụ bổ sung: hành lý, chỗ ngồi, suất ăn (tùy chọn)",
      "5. Kiểm tra lại thông tin và thanh toán",
      "6. Nhận mã vé qua email/SMS"
    ],
    passengerInfo: {
      required: "Họ tên đầy đủ (theo CMND/Passport), ngày sinh, giới tính",
      note: "Nhập đúng họ tên theo giấy tờ tùy thân, không dấu, in hoa"
    },
    confirmation: "Mã vé sẽ được gửi qua email và SMS trong vòng 5-10 phút sau khi thanh toán thành công"
  },

  contact: {
    hotline: "1900-xxxx (8:00 - 22:00 hàng ngày)",
    email: "support@skyline.vn",
    workingHours: "Thứ 2 - Chủ nhật: 8:00 - 22:00",
    responseTime: "Email: phản hồi trong 24h, Hotline: hỗ trợ ngay"
  },

  airlines: {
    VN: {
      name: "Vietnam Airlines",
      code: "VN",
      hotline: "1900-1100",
      policies: "Hành lý: 23kg (Eco), 32kg (Bus). Check-in online 24h trước giờ bay."
    },
    VJ: {
      name: "Vietjet Air",
      code: "VJ",
      hotline: "1900-1886",
      policies: "Hành lý: mua thêm. Check-in online từ 24h-2h trước giờ bay."
    },
    QH: {
      name: "Bamboo Airways",
      code: "QH",
      hotline: "1900-1166",
      policies: "Hành lý: 23kg (Eco), 30kg (Bus). Miễn phí đổi 1 lần."
    },
    BL: {
      name: "Pacific Airlines",
      code: "BL",
      hotline: "1900-1800",
      policies: "Hành lý: 20kg (Eco), 30kg (Bus)."
    },
    VU: {
      name: "Vietravel Airlines",
      code: "VU",
      hotline: "1900-1865",
      policies: "Hành lý: 23kg (Eco). Ưu đãi tour du lịch."
    }
  }
};

const FAQ = {
  "làm sao để đặt vé": {
    answer: POLICIES.booking.steps.join("\n"),
    relatedTopics: ["thanh toán", "thông tin hành khách"]
  },
  "chính sách hành lý": {
    answer: `${POLICIES.baggage.carryOn.economy}\n${POLICIES.baggage.checked.economy}\n${POLICIES.baggage.excess}\n\nLưu ý:\n${POLICIES.baggage.restricted.map(r => `- ${r}`).join("\n")}`,
    relatedTopics: ["hành lý ký gửi", "hành lý xách tay"]
  },
  "làm thủ tục bay": {
    answer: `Check-in online:\n- ${POLICIES.checkIn.online.time}\n- ${POLICIES.checkIn.online.howTo}\n\nCheck-in tại sân bay:\n- ${POLICIES.checkIn.airport.domestic}\n- ${POLICIES.checkIn.airport.deadline}\n\nGiấy tờ cần thiết: ${POLICIES.checkIn.documents.domestic}`,
    relatedTopics: ["check-in", "giấy tờ"]
  },
  "hoàn vé": {
    answer: `${POLICIES.refundChange.refund.refundable}\n${POLICIES.refundChange.refund.nonRefundable}\nPhí: ${POLICIES.refundChange.refund.fee}\nThời hạn: ${POLICIES.refundChange.refund.timeLimit}\n\nCách hoàn: ${POLICIES.refundChange.refund.process}`,
    relatedTopics: ["đổi vé", "phí hoàn"]
  },
  "đổi vé": {
    answer: `${POLICIES.refundChange.change.allowed}\nPhí: ${POLICIES.refundChange.change.fee}\nThời hạn: ${POLICIES.refundChange.change.timeLimit}\n\nCách đổi: ${POLICIES.refundChange.change.process}`,
    relatedTopics: ["hoàn vé", "sửa tên"]
  },
  "thanh toán": {
    answer: `Phương thức thanh toán:\n${POLICIES.payment.methods.map(m => `- ${m}`).join("\n")}\n\nBảo mật:\n${POLICIES.payment.security.map(s => `- ${s}`).join("\n")}`,
    relatedTopics: ["lỗi thanh toán", "bảo mật"]
  },
  "liên hệ": {
    answer: `Hotline: ${POLICIES.contact.hotline}\nEmail: ${POLICIES.contact.email}\nGiờ làm việc: ${POLICIES.contact.workingHours}\nThời gian phản hồi: ${POLICIES.contact.responseTime}`,
    relatedTopics: ["hỗ trợ", "khiếu nại"]
  }
};

function detectPolicyIntent(message) {
  const normalized = message.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const intents = {
    baggage: /(hanh ly|hanh li|ky gui|xach tay|kg|can nang)/.test(normalized),
    checkIn: /(check.?in|lam thu tuc|thu tuc bay|gio bay)/.test(normalized),
    refund: /(hoan ve|huy ve|refund|tra ve)/.test(normalized),
    change: /(doi ve|doi ngay|doi gio|thay doi|change)/.test(normalized),
    payment: /(thanh toan|payment|the|atm|visa|chuyen khoan|momo|zalopay|loi thanh toan)/.test(normalized),
    booking: /(dat ve|book|cach dat|huong dan dat|dang ky)/.test(normalized),
    contact: /(lien he|hotline|email|ho tro|support|cskh)/.test(normalized),
    airline: /(hang bay|vietnam airlines|vietjet|bamboo|pacific|vietravel|vn|vj|qh|bl|vu)/.test(normalized),
    documents: /(giay to|cmnd|cccd|ho chieu|passport|visa)/.test(normalized),
  };

  return Object.keys(intents).filter(key => intents[key]);
}

function getPolicyAnswer(intents, message) {
  const normalized = message.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const answers = [];

  if (intents.includes('baggage')) {
    if (/xach tay|cabin/.test(normalized)) {
      answers.push(`📦 Hành lý xách tay:\n${POLICIES.baggage.carryOn.economy}\n${POLICIES.baggage.carryOn.business}`);
    } else if (/ky gui|check/.test(normalized)) {
      answers.push(`🧳 Hành lý ký gửi:\n${POLICIES.baggage.checked.economy}\n${POLICIES.baggage.checked.business}`);
    } else {
      answers.push(FAQ["chính sách hành lý"].answer);
    }
  }

  if (intents.includes('checkIn')) {
    answers.push(FAQ["làm thủ tục bay"].answer);
  }

  if (intents.includes('refund')) {
    answers.push(FAQ["hoàn vé"].answer);
  }

  if (intents.includes('change')) {
    answers.push(FAQ["đổi vé"].answer);
  }

  if (intents.includes('payment')) {
    if (/loi|that bai|failed|bi tru|duplicate/.test(normalized)) {
      answers.push(`⚠️ Xử lý lỗi thanh toán:\n- ${POLICIES.payment.issues.failed}\n- ${POLICIES.payment.issues.duplicate}\n- ${POLICIES.payment.issues.timeout}`);
    } else {
      answers.push(FAQ["thanh toán"].answer);
    }
  }

  if (intents.includes('booking')) {
    answers.push(FAQ["làm sao để đặt vé"].answer);
  }

  if (intents.includes('contact')) {
    answers.push(FAQ["liên hệ"].answer);
  }

  if (intents.includes('airline')) {
    const airlineMatches = [];
    for (const [code, info] of Object.entries(POLICIES.airlines)) {
      const pattern = new RegExp(info.name.toLowerCase().replace(/\s/g, '|') + `|${code.toLowerCase()}`, 'i');
      if (pattern.test(normalized)) {
        airlineMatches.push(`✈️ ${info.name} (${code}):\nHotline: ${info.hotline}\nChính sách: ${info.policies}`);
      }
    }
    if (airlineMatches.length) {
      answers.push(...airlineMatches);
    } else {
      answers.push(`Các hãng bay phổ biến:\n${Object.values(POLICIES.airlines).map(a => `- ${a.name} (${a.code}): ${a.hotline}`).join('\n')}`);
    }
  }

  if (intents.includes('documents')) {
    answers.push(`📄 Giấy tờ cần thiết:\n- Nội địa: ${POLICIES.checkIn.documents.domestic}\n- Quốc tế: ${POLICIES.checkIn.documents.international}`);
  }

  return answers.length > 0 ? answers.join('\n\n') : null;
}

function getRelatedQuestions(intents) {
  const questions = new Set();

  if (intents.includes('baggage')) {
    questions.add("Hành lý xách tay được mang bao nhiêu kg?");
    questions.add("Phí hành lý quá cước là bao nhiêu?");
  }

  if (intents.includes('checkIn')) {
    questions.add("Check-in online như thế nào?");
    questions.add("Cần có mặt tại sân bay trước bao lâu?");
  }

  if (intents.includes('refund') || intents.includes('change')) {
    questions.add("Phí hoàn vé là bao nhiêu?");
    questions.add("Có thể đổi tên người bay không?");
  }

  if (intents.includes('payment')) {
    questions.add("Thanh toán bằng thẻ có an toàn không?");
    questions.add("Thanh toán thất bại phải làm sao?");
  }

  if (intents.includes('booking')) {
    questions.add("Cần điền thông tin gì khi đặt vé?");
    questions.add("Bao lâu nhận được mã vé sau khi thanh toán?");
  }

  return Array.from(questions);
}

module.exports = {
  POLICIES,
  FAQ,
  detectPolicyIntent,
  getPolicyAnswer,
  getRelatedQuestions
};
