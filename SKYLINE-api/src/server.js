const http = require("http");
const { createApp } = require("./app");
const { initSocket } = require("./socket");

const app = createApp();
const server = http.createServer(app);

console.log("SERVER FILE:", __filename);
console.log("Loading routes...");

const PORT = process.env.PORT || 5000;
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
