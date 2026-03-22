require("dotenv").config();
const mongoose = require("mongoose");
const aiChatService = require("./src/services/aiChatService");

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const tests = [
      "ngày mai có chuyến bay nào không",
      "ngày 23/03 có chuyến bay sài gòn - hà nội không",
      "có bao nhiêu chuyến bay vào ngày mai",
      "chuyến bay vietnam airlines ngày mai",
      "chuyến bay rẻ nhất từ sài gòn đi hà nội",
    ];

    for (const message of tests) {
      console.log("\n" + "=".repeat(80));
      console.log("TEST:", message);
      console.log("=".repeat(80));

      const result = await aiChatService.chat({
        sessionId: `test-${Date.now()}`,
        message,
        resetContext: true,
      });

      console.log("\nReply:", result.reply);
      console.log("\nProvider:", result.provider);
      console.log("Model:", result.model);
      console.log("Fallback:", result.fallback);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

test();
