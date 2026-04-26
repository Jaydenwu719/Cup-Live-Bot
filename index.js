const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

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
const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= STATE =================

let cup = {
  game: "none",
  round: 1,

  currentGame: "overall", // default view

  overall: {},

  games: {},

  page: 0,

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

    let arrow = "";

    if (prevRank !== undefined) {
      if (prevRank > rank) arrow = "⬆️";
      else if (prevRank < rank) arrow = "⬇️";
      else arrow = "➡️";
    }

    cup.games[currentGame].previousRankings

    desc += `${rank}. <@${id}> — **${data.points} pts** ${arrow}\n`;
  });

  return desc || "No players yet";
}

// ================= LIVE LEADERBOARD (PRO VERSION) =================
async function updateLeaderboard() {
  try {
    if (!cup.leaderboardMessageId || !cup.leaderboardChannelId) return;

    const channel = await client.channels.fetch(cup.leaderboardChannelId);
    const msg = await channel.messages.fetch(cup.leaderboardMessageId);

    const dataSource =
  cup.currentGame === "overall"
    ? cup.overall
    : cup.games[cup.currentGame]?.leaderboard || {};

const sorted = Object.entries(dataSource)
  .sort((a, b) => b[1].points - a[1].points);

    const perPage = 6;
    if (!cup.page) cup.page = 0;

    const start = cup.page * perPage;
    const slice = sorted.slice(start, start + perPage);

    let desc = "";

    let lastPoints = null;
    let rank = start + 1;

    slice.forEach(([id, data], i) => {

      // 🧠 SAME POINTS = SAME RANK
      if (lastPoints === null) {
    rank = start + 1;
    } else if (data.points < lastPoints) {
    rank = rank + 1;
    }

      lastPoints = data.points;

      // 🏅 rank styling
      let rankDisplay;
      if (rank === 1) rankDisplay = "🥇";
      else if (rank === 2) rankDisplay = "🥈";
      else if (rank === 3) rankDisplay = "🥉";
      else rankDisplay = `✨ ${rank}.`;

      // 📊 movement arrows
      const prev =
  cup.games[cup.currentGame]?.previousRankings?.[id];
      let arrow = "";

      if (prev !== undefined) {
        if (prev > rank) arrow = "⬆️";
        else if (prev < rank) arrow = "⬇️";
        else arrow = "➡️";
      }

      if (!cup.games[cup.currentGame].previousRankings) {
  cup.games[cup.currentGame].previousRankings = {};
}

cup.games[cup.currentGame].previousRankings[id] = rank;

      // ✨ clean output
      desc += `${rankDisplay} ${arrow} <@${id}> • **${data.points} pts**\n`;
    });

    if (!desc) desc = "🌌 No competitors yet...";

    const embed = new EmbedBuilder()
      .setTitle("✨ COSMIC CUP — LIVE ✨")
      .setDescription(
        `🎮 **${cup.currentGame || "No Game"}**\n\n` +
        `━━━━━━━━━━━━━━\n` +
        desc +
        `━━━━━━━━━━━━━━`
      )
      .setColor(0xA855F7)
      .setFooter({ text: `Page ${cup.page + 1} • Round ${cup.round}` })
      .setTimestamp();

    const { StringSelectMenuBuilder } = require("discord.js");

const options = [
  {
    label: "🏆 Overall",
    value: "overall",
    description: "All games combined"
  }
];

// add current game dynamically
for (const game of Object.keys(cup.games)) {
  options.push({
    label: `🎮 ${game}`,
    value: game,
    description: `Leaderboard for ${game}`
  });
}

const row = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("leaderboard_select")
    .setPlaceholder("Select leaderboard view")
    .addOptions(options),

  new ButtonBuilder()
    .setCustomId("prev")
    .setLabel("⬅️")
    .setStyle(ButtonStyle.Secondary),

  new ButtonBuilder()
    .setCustomId("next")
    .setLabel("➡️")
    .setStyle(ButtonStyle.Secondary)
);

    await msg.edit({
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.log("❌ leaderboard update failed:", err.message);
  }
}

// ================= COMMANDS =================

client.on("interactionCreate", async (i) => {

  // ================= DROPDOWN =================
  if (i.isStringSelectMenu()) {
    if (i.customId === "leaderboard_select") {
      cup.currentGame = i.values[0];
      cup.page = 0;
      await updateLeaderboard();
      return i.deferUpdate();
    }
  }

  // ================= BUTTONS =================
  if (i.isButton()) {
    if (i.customId === "next") cup.page++;
    if (i.customId === "prev") cup.page = Math.max(0, cup.page - 1);

    await updateLeaderboard();
    return i.deferUpdate();
  }

  // ================= SLASH COMMANDS =================
  if (!i.isChatInputCommand()) return;

  // 🏆 START
if (i.commandName === "start") {
  await updateLeaderboard();
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

const gameName = i.options.getString("game");

cup.game = gameName;
cup.currentGame = gameName;
cup.page = 0;

if (!cup.games[gameName]) {
  cup.games[gameName] = {
    leaderboard: {},
    previousRankings: {}
  };
}

  const msg = await i.channel.send({
  embeds: [
    new EmbedBuilder()
      .setTitle("🏆 LIVE LEADERBOARD")
      .setDescription("🌌 No players yet...")
      .setColor(0x00ffcc)
  ]
});

  cup.leaderboardMessageId = msg.id;
  cup.leaderboardChannelId = i.channel.id;

  return i.reply({
    content: `🏆 CUP LIVE STARTED\n🎮 ${cup.game}`,
    ephemeral: false
  });
}
  // 📊 SCORE

if (i.commandName === "score") {
  await i.deferReply();
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

  const user = i.options.getUser("user");
  const pts = i.options.getInteger("points");

  if (!cup.currentGame || !cup.games[cup.currentGame]) {
    return i.reply("⚠️ No active game. Use /start first.");
  }

  const game = cup.games[cup.currentGame];

if (!game) return i.reply("⚠️ Game not found");

initPlayer(game.leaderboard, user.id, user.username);
initPlayer(cup.overall, user.id, user.username);

game.leaderboard[user.id].points += pts;
cup.overall[user.id].points += pts;

try {
  await updateLeaderboard();
} catch (err) {
  console.log("Leaderboard safe fail:", err.message);
}

  return i.editReply(`📊 ${user.username} +${pts} pts`);
}

  // ⚔️ 1v1 MATCH
if (i.commandName === "match") {
  await i.deferReply();
  if (!isRef(i.member))
    return i.reply({ content: "Ref only", ephemeral: true });

  const winner = i.options.getUser("winner");
  const loser = i.options.getUser("loser");

  if (!cup.currentGame || !cup.games[cup.currentGame]) {
    return i.reply("⚠️ No active game. Use /start first.");
  }

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

  // 📊 update Discord leaderboard message (if you use it)
  updateLeaderboard();

  return i.editReply(`📊 ${user.username} +${pts} pts`);
}

  // 🏁 END
  if (i.commandName === "end") {
    cup.round++;
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

  return i.reply(`🏆 FINAL CUP RESULTS\n\n${sorted}`);
}
});

// ================= PAGINATION =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "next") {
    cup.page++;
  }

  if (i.customId === "prev") {
    cup.page = Math.max(0, cup.page - 1);
  }

  await updateLeaderboard();

  return i.deferUpdate();
});

client.once("clientReady", () => {
  console.log(`🏆 CUP LIVE BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);