const express = require("express");

const app = express();
app.use(express.json());

// 🏆 LIVE CUP STATE
let state = {
  game: "none",
  round: 1,
  scores: {},
  updatedAt: Date.now()
};

// 🌐 serve overlay files
app.use(express.static(__dirname));

// 📡 receive bot updates
app.post("/update", (req, res) => {
  state = {
    ...req.body,
    updatedAt: Date.now()
  };

  console.log("📡 UPDATE RECEIVED");
  res.sendStatus(200);
});

// 📊 overlay reads data
app.get("/data", (req, res) => {
  res.json(state);
});

// 🧠 health check
app.get("/", (req, res) => {
  res.send("🏆 CUP LIVE ONLINE");
});

// 🚀 PORT (RENDER REQUIRED)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🏆 CUP LIVE running on port", PORT);
});