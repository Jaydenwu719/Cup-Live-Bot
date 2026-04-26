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
  const gameKey = cup.currentGame;

if (!cup.games[gameKey]) {
  cup.games[gameKey] = {
    leaderboard: {},
    previousRankings: {}
  };
}

if (!cup.games[gameKey].previousRankings) {
  cup.games[gameKey].previousRankings = {};
}
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
  if (i > 0 && data.points < slice[i - 1][1].points) {
    rank = start + i + 1;
  }


    if (!desc) {
  desc = "🌌 No competitors yet...";
}
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

const selectRow = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("leaderboard_select")
    .setPlaceholder("Select leaderboard view")
    .addOptions(options)
);

const buttonRow = new ActionRowBuilder().addComponents(
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
      components: [selectRow, buttonRow]
    });

  } catch (err) {
    console.log("❌ leaderboard update failed:", err.message);
  }
}

// ================= InteractionCreate =================

client.on("interactionCreate", async (i) => {
  try {

    // ================= DROPDOWN =================
    if (i.isStringSelectMenu()) {
      if (i.isButton()) {
  const dataSource =
    cup.currentGame === "overall"
      ? cup.overall
      : cup.games[cup.currentGame]?.leaderboard || {};

  const maxPage = Math.max(
    0,
    Math.ceil(Object.keys(dataSource).length / 6) - 1
  );

  if (i.customId === "next") {
    if (cup.page < maxPage) cup.page++;
  }

  if (i.customId === "prev") {
    cup.page = Math.max(0, cup.page - 1);
  }

  await i.deferUpdate();
  await updateLeaderboard();
  return;
}
    }

    // ================= BUTTONS =================
    if (i.isButton()) {
      if (i.customId === "next") cup.page++;
      if (i.customId === "prev") cup.page = Math.max(0, cup.page - 1);

      await i.deferUpdate();
      await updateLeaderboard();
      return;
    }

    // ================= SLASH COMMANDS =================
    if (!i.isChatInputCommand()) return;

    // ---------------- START ----------------
    if (i.commandName === "start") {
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

      await i.reply(`🏆 CUP LIVE STARTED\n🎮 ${gameName}`);
      await updateLeaderboard();
    }

    // ---------------- SCORE ----------------
    if (i.commandName === "score") {
      if (!isRef(i.member))
        return i.reply({ content: "Ref only", ephemeral: true });

      const user = i.options.getUser("user");
      const pts = i.options.getInteger("points");

      const game = cup.games[cup.currentGame];
      if (!game) return i.reply("⚠️ No active game");

      initPlayer(game.leaderboard, user.id, user.username);
      initPlayer(cup.overall, user.id, user.username);

      game.leaderboard[user.id].points += pts;
      cup.overall[user.id].points += pts;

      await i.reply(`📊 ${user.username} +${pts} pts`);
      await updateLeaderboard();
    }

  } catch (err) {
    console.log("Interaction error:", err);
  }
});

// ================= PAGINATION =================

client.once("clientReady", () => {
  console.log(`🏆 CUP LIVE BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);