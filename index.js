<<<<<<< HEAD
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ================= LIVE STATE =================

let cup = {
  games: {},
  overall: {},
  currentGame: ""
};

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
=======
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// 🌍 YOUR HOSTED SERVER (Render)
const API = "https://cup-live.onrender.com";

// 🔐 TOKEN COMES FROM ENV (NOT CODE)
const TOKEN = process.env.TOKEN;
>>>>>>> 7980d7a (clean CUP LIVE initial upload (no secrets))

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

<<<<<<< HEAD
const TOKEN = process.env.TOKEN;

// ensure game exists
function initGame(game) {
  if (!cup.games[game]) {
    cup.games[game] = {
      leaderboard: {},
      bracket: {},
      matches: {}
    };
  }
}

// ================= INTERACTIONS =================

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // 🏆 START GAME
  if (i.commandName === "start") {
    const game = i.options.getString("game");
    const bracket = i.options.getBoolean("bracket") || false;

    cup.currentGame = game;
    cup.bracketMode = bracket;

    initGame(game);

    return i.reply(
`🏆 CUP LIVE STARTED
🎮 ${game}
📊 https://cup-live.onrender.com/overlay.html`
    );
  }

  // 📊 SCORE
  if (i.commandName === "score") {
    const user = i.options.getUser("user");
    const points = i.options.getInteger("points");

    if (!cup.currentGame) {
      return i.reply("No game started");
    }

    initGame(cup.currentGame);

    const game = cup.games[cup.currentGame];

    // leaderboard
    if (!game.leaderboard[user.id]) {
      game.leaderboard[user.id] = {
=======
// 🏆 CUP STATE
let cup = {
  game: "none",
  round: 1,
  scores: {}
};

// 🔐 Admin / Ref check
function isRef(member) {
  return member.permissions.has("Administrator") ||
         member.permissions.has("ManageGuild");
}

// 📡 Sync to Render server
async function sync() {
  try {
    await axios.post(`${API}/update`, cup);
    console.log("SYNC OK");
  } catch (err) {
    console.log("SYNC ERROR:", err.message);
  }
}

// ================= COMMANDS =================
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  // 🎮 START GAME
  if (i.commandName === 'start') {

    if (!isRef(i.member))
      return i.reply({ content: "Ref only", ephemeral: true });

    cup.game = i.options.getString('game');

    await sync();

    return i.reply(`🏆 CUP LIVE started: ${cup.game}`);
  }

  // 🏆 SCORE COMMAND
  if (i.commandName === 'score') {

    if (!isRef(i.member))
      return i.reply({ content: "Ref only", ephemeral: true });

    const user = i.options.getUser('user');
    const pts = i.options.getInteger('points');

    if (!cup.scores[user.id]) {
      cup.scores[user.id] = {
>>>>>>> 7980d7a (clean CUP LIVE initial upload (no secrets))
        name: user.username,
        points: 0
      };
    }

<<<<<<< HEAD
    // overall
    if (!cup.overall[user.id]) {
      cup.overall[user.id] = {
        name: user.username,
        points: 0
      };
    }

    game.leaderboard[user.id].points += points;
    cup.overall[user.id].points += points;

    return i.reply(`📊 ${user.username} +${points} pts`);
  }

  // 🧩 BRACKET MATCH (1v1)
  if (i.commandName === "score") {
    const user = i.options.getUser("user");
    const against = i.options.getUser("against");

    if (!against || !cup.currentGame) return;

    const game = cup.games[cup.currentGame];

    const matchId = `${user.id}_vs_${against.id}`;

    if (game.matches[matchId]) {
      return i.reply("Match already played");
    }

    game.matches[matchId] = {
      winner: user.username,
      loser: against.username
    };

    if (!game.leaderboard[user.id]) {
      game.leaderboard[user.id] = { name: user.username, points: 0 };
    }

    if (!cup.overall[user.id]) {
      cup.overall[user.id] = { name: user.username, points: 0 };
    }

    game.leaderboard[user.id].points += 1;
    cup.overall[user.id].points += 1;

    return i.reply(`🏁 ${user.username} wins 1v1 match`);
  }
});

client.once("ready", () => {
  console.log("BOT ONLINE");
});

=======
    cup.scores[user.id].points += pts;

    await sync();

    return i.reply(`+${pts} → ${user.username}`);
  }

  // 🏁 END ROUND
  if (i.commandName === 'end') {
    cup.round++;
    await sync();
    return i.reply("🏁 Round ended");
  }
});

// 🤖 BOT READY
client.once('ready', () => {
  console.log(`🏆 CUP LIVE BOT ONLINE: ${client.user.tag}`);
});

// 🔐 LOGIN
>>>>>>> 7980d7a (clean CUP LIVE initial upload (no secrets))
client.login(TOKEN);