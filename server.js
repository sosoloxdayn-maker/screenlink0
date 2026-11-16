const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/room/:id", (_req, res) => res.sendFile(__dirname + "/public/index.html"));

io.on("connection", socket => {
  socket.on("create-room", () => {
    const room = crypto.randomBytes(5).toString("hex");
    socket.join(room);
    socket.emit("room-created", room);
  });

  socket.on("join-room", ({ room, role }) => {
    if (typeof room !== "string" || !/^[a-z0-9]{6,20}$/i.test(room)) {
      socket.emit("app-error", "Неверный код комнаты.");
      return;
    }
    const members = io.sockets.adapter.rooms.get(room);
    if (members && members.size >= 2) {
      socket.emit("app-error", "В комнате уже два участника.");
      return;
    }
    socket.join(room);
    socket.data.room = room;
    socket.data.role = role;
    socket.to(room).emit("peer-joined", { role });
    socket.emit("joined-room", { room, role });
  });

  for (const event of ["offer", "answer", "ice", "recording-started", "recording-stopped", "leave-room"]) {
    socket.on(event, payload => {
      const room = socket.data.room;
      if (room) socket.to(room).emit(event, payload);
      if (event === "leave-room" && room) socket.leave(room);
    });
  }
  socket.on("disconnect", () => {
    if (socket.data.room) socket.to(socket.data.room).emit("peer-left");
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`ScreenLink listening on ${port}`));