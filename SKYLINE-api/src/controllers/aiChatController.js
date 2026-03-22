const aiChatService = require("../services/aiChatService");

exports.chat = async (req, res) => {
  try {
    const { sessionId, message, resetContext } = req.body || {};

    const result = await aiChatService.chat({
      sessionId,
      message,
      resetContext: Boolean(resetContext),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error?.message || "AI chat failed",
    });
  }
};
