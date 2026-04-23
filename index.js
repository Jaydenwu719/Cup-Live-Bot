const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

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

  scores: {},

  overall: {},          // 🔥 REQUIRED FIX
  previousRankings: {}, // 🔥 REQUIRED FIX

  currentGame: "",

  games: {},

  updatedAt: Date.now()
};

// ================= HELPERS =================

function isRef(member) {
  return member.permissions.has("Administrator") ||
         member.permissions.has("ManageGuild");
}

function initGame(game) {
  if (!cup.games) cup.games = {};

  if (!cup.games[game]) {
    cup.games[game] = {
      leaderboard: {},
      bracket: {},
      matches: {}
    };
  }
}

function initPlayer(obj, id, name) {
  if (!obj[id]) {
    obj[id] = { name, points: 0 };
  }
}

function buildLeaderboard(page = 0) {
  const sorted = Object.entries(cup.overall)
    .sort((a, b) => b[1].points - a[1].points);

  const perPage = 6;
  const start = page * perPage;
  const slice = sorted.slice(start, start + perPage);

  let desc = "";

  slice.forEach(([id, data], index) => {
    const rank = start + index + 1;

    const prevRank = cup.previousRankings[id];

    let arrow = "";

    if (prevRank !== undefined) {
      if (prevRank > rank) arrow = "⬆️";
      else if (prevRank < rank) arrow = "⬇️";
      else arrow = "➡️";
    }

    cup.previousRankings[id] = rank;

    desc += `${rank}. <@${id}> — **${data.points} pts** ${arrow}\n`;
  });

  return desc || "No players yet";
}

if (!cup.games) cup.games = {};
if (!cup.overall) cup.overall = {};
if (!cup.previousRankings) cup.previousRankings = {};

// ================= COMMANDS =================

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // 🏆 START
if (i.commandName === "start") {
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

  // 🔥 reply FIRST (prevents 40060 error)
  await i.reply(`🏆 Starting CUP LIVE...`);

  cup.game = i.options.getString("game");
  cup.currentGame = cup.game;

  initGame(cup.game);
  cup.previousRankings = {};

  const embed = new EmbedBuilder()
    .setTitle(`🏆 CUP LIVE STARTED`)
    .setDescription(`Game: ${cup.game}`)
    .setColor(0x00ffcc);

  const msg = await i.channel.send({ embeds: [embed] });

  cup.leaderboardMessageId = msg.id;
  cup.leaderboardChannelId = i.channel.id;

  await sync();

  // 🔥 edit instead of replying again
  return i.editReply(`🏆 CUP LIVE STARTED\n🎮 ${cup.game}`);
}
  // 📊 SCORE

if (i.commandName === "score") {
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

  const user = i.options.getUser("user");
  const pts = i.options.getInteger("points");

  // 🚨 SAFETY CHECK
  if (!cup.currentGame || !cup.games[cup.currentGame]) {
    return i.reply("⚠️ No active game. Use /start first.");
  }

  const game = cup.games[cup.currentGame];

  // 🧠 SAFE PLAYER INIT
  if (!game.leaderboard[user.id]) {
    game.leaderboard[user.id] = {
      name: user.username,
      points: 0
    };
  }

  if (!cup.overall[user.id]) {
    cup.overall[user.id] = {
      name: user.username,
      points: 0
    };
  }

  game.leaderboard[user.id].points += pts;
  cup.overall[user.id].points += pts;

await sync();

// 🔥 LIVE LEADERBOARD UPDATE (THIS WAS MISSING)
const channel = await i.client.channels.fetch(cup.leaderboardChannelId);
updateLeaderboard(channel).catch(() => {});

if (!i.replied && !i.deferred) {
  return i.reply(`📊 ${user.username} +${pts} pts`);
} else {
  return i.followUp(`📊 ${user.username} +${pts} pts`);
}
}

  // ⚔️ 1v1 MATCH
if (i.commandName === "match") {
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

  const winner = i.options.getUser("winner");
  const loser = i.options.getUser("loser");

  if (!cup.currentGame || !cup.games[cup.currentGame]) {
    return i.reply("⚠️ No active game. Use /start first.");
  }

  const game = cup.games[cup.currentGame];

  const matchId = `${winner.id}_vs_${loser.id}`;

  if (game.matches[matchId]) {
    return i.reply("Match already recorded");
  }

  // 🧠 store match result
  game.matches[matchId] = {
    winner: winner.username,
    loser: loser.username
  };

  // 🧠 ensure leaderboard exists
  if (!game.leaderboard[winner.id]) {
    game.leaderboard[winner.id] = { name: winner.username, points: 0 };
  }

  if (!game.leaderboard[loser.id]) {
    game.leaderboard[loser.id] = { name: loser.username, points: 0 };
  }

  if (!cup.overall[winner.id]) {
    cup.overall[winner.id] = { name: winner.username, points: 0 };
  }

  if (!cup.overall[loser.id]) {
    cup.overall[loser.id] = { name: loser.username, points: 0 };
  }

  // 🏆 GIVE POINTS (THIS IS THE IMPORTANT PART YOU ASKED FOR)
  // adjustable scoring system
const winPoints = 1;

game.leaderboard[winner.id].points += winPoints;
cup.overall[winner.id].points += winPoints;

  // optional: loser tracking (no points, but keeps consistency)
  game.leaderboard[loser.id].points += 0;

  // 📡 update live overlay
  await sync();

  // 📊 update Discord leaderboard message (if you use it)
  const channel = await i.client.channels.fetch(cup.leaderboardChannelId);
  updateLeaderboard(channel).catch(() => {});

  return i.reply(`🏁 ${winner.username} wins +1 point`);
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

  if (i.commandName === "end-cup") {
  const sorted = Object.entries(cup.overall)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([id, data], i) => `${i + 1}. ${data.name} - ${data.points} pts`)
    .join("\n");

  await sync();

  return i.reply(`🏆 FINAL CUP RESULTS\n\n${sorted}`);
}

});

client.once("clientReady", () => {
  console.log(`🏆 CUP LIVE BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);