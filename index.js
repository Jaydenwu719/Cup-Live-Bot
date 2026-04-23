const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ================= WEBSITE API =================

app.get("/data", (req, res) => {
  res.json(cup);
});

// prevent caching (VERY IMPORTANT for live updates)
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING:", PORT);
});

// ================= DISCORD BOT =================

const axios = require("axios");
const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const API = "https://cup-live.onrender.com";

// ================= STATE =================

let cup = {
  game: "none",
  round: 1,
  currentGame: "",
  bracketMode: false,

  games: {},      // per game leaderboard
  overall: {}     // global leaderboard
};

// ================= HELPERS =================

function isRef(member) {
  return member.permissions.has("Administrator") ||
         member.permissions.has("ManageGuild");
}

function initGame(game) {
  if (!cup.games[game]) {
    cup.games[game] = {
      leaderboard: {},
      matches: {}
    };
  }
}

function initPlayer(obj, id, name) {
  if (!obj[id]) {
    obj[id] = { name, points: 0 };
  }
}

async function sync() {
  try {
    await axios.post(`${API}/update`, cup);
  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

// ================= COMMANDS =================

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // 🏆 START
  if (i.commandName === "start") {
    if (!isRef(i.member))
      return i.reply({ content: "Ref only", ephemeral: true });

    cup.game = i.options.getString("game");
    cup.currentGame = cup.game;

    initGame(cup.game);

    await sync();

    return i.reply(`🏆 CUP LIVE STARTED\n🎮 ${cup.game}`);
  }

  // 📊 SCORE
  if (i.commandName === "score") {
    if (!isRef(i.member))
      return i.reply({ content: "Ref only", ephemeral: true });

    const user = i.options.getUser("user");
    const pts = i.options.getInteger("points");

    initGame(cup.currentGame);

    const game = cup.games[cup.currentGame];

    initPlayer(game.leaderboard, user.id, user.username);
    initPlayer(cup.overall, user.id, user.username);

    game.leaderboard[user.id].points += pts;
    cup.overall[user.id].points += pts;

    await sync();

    return i.reply(`📊 ${user.username} +${pts} pts`);
  }

  // ⚔️ 1v1 MATCH
  if (i.commandName === "match") {
    const winner = i.options.getUser("winner");
    const loser = i.options.getUser("loser");

    initGame(cup.currentGame);

    const game = cup.games[cup.currentGame];

    const matchId = `${winner.id}_vs_${loser.id}`;

    if (game.matches[matchId]) {
      return i.reply("Match already recorded");
    }

    game.matches[matchId] = {
      winner: winner.username,
      loser: loser.username
    };

    initPlayer(game.leaderboard, winner.id, winner.username);
    initPlayer(cup.overall, winner.id, winner.username);

    game.leaderboard[winner.id].points += 1;
    cup.overall[winner.id].points += 1;

    await sync();

    return i.reply(`🏁 ${winner.username} wins 1v1`);
  }

  // 🏁 END
  if (i.commandName === "end") {
    cup.round++;
    await sync();
    return i.reply("🏁 Round ended");
  }

  // 📊 LEADERBOARD
  if (i.commandName === "leaderboard") {
    const sorted = Object.entries(cup.overall)
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10)
      .map(([id, data], i) => `${i + 1}. ${data.name} - ${data.points} pts`)
      .join("\n");

    return i.reply(`🏆 GLOBAL LEADERBOARD\n\n${sorted}`);
  }
});

client.once("ready", () => {
  console.log(`🏆 CUP LIVE BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);