require("dotenv").config();
const mongoose = require("mongoose");
const aiChatService = require("./src/services/aiChatService");

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const testCases = [
      {
        category: "🔍 TÌM CHUYẾN BAY",
        tests: [
          "ngày mai có chuyến bay nào không",
          "chuyến bay từ sài gòn đi hà nội ngày 25/03",
          "có chuyến bay vietnam airlines nào tuần sau không",
          "chuyến bay rẻ nhất từ SGN đi DAD",
          "có bao nhiêu chuyến bay vào tháng này",
        ]
      },
      {
        category: "📋 CHÍNH SÁCH",
        tests: [
          "chính sách hành lý như thế nào",
          "làm thủ tục bay cần những gì",
          "tôi muốn hoàn vé phải làm sao",
          "đổi vé mất phí bao nhiêu",
          "thanh toán bằng thẻ có an toàn không",
        ]
      },
      {
        category: "🎫 TRA CỨU VÉ",
        tests: [
          "tra cứu vé TCKA000062",
          "tôi muốn kiểm tra vé của mình",
          "vé của tôi bị lỗi thanh toán",
        ]
      },
      {
        category: "🎁 KHUYẾN MÃI",
        tests: [
          "có khuyến mãi gì không",
          "mã giảm giá hiện tại",
        ]
      },
      {
        category: "✈️ HÃNG BAY",
        tests: [
          "hotline vietnam airlines là gì",
          "cho tôi thông tin về vietjet",
        ]
      },
      {
        category: "❓ CÂU HỎI CHUNG",
        tests: [
          "làm sao để đặt vé",
          "liên hệ hỗ trợ như thế nào",
        ]
      }
    ];

    const sessionId = `test-session-${Date.now()}`;

    for (const testCase of testCases) {
      console.log("\n" + "=".repeat(80));
      console.log(testCase.category);
      console.log("=".repeat(80));

      for (const message of testCase.tests) {
        console.log(`\n📝 Q: ${message}`);

        const result = await aiChatService.chat({
          sessionId,
          message,
          resetContext: false,
        });

        console.log(`💬 A: ${result.reply.substring(0, 300)}${result.reply.length > 300 ? '...' : ''}`);
        console.log(`🤖 Provider: ${result.provider} | Model: ${result.model}`);
      }
    }

    console.log("\n\n✅ All tests completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();
