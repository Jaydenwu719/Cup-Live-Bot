const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

app.use(express.json());

// ================= STATE =================

let cup = {
  currentGame: "overall",
  overall: {},
  games: {},
  page: 0,
  leaderboardMessageId: null,
  leaderboardChannelId: null,
  round: 0
};

// ================= EXPRESS =================

app.get("/data", (req, res) => {
  res.json(cup);
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING:", PORT);
});

// ================= DISCORD =================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;

// ================= HELPERS =================

function isRef(member) {
  return member.permissions.has("Administrator") ||
         member.permissions.has("ManageGuild");
}

function initGame(game) {
  if (!cup.games[game]) {
    cup.games[game] = {
      leaderboard: {},
      previousRankings: {}
    };
  }
}

function initPlayer(obj, id, name) {
  if (!obj[id]) obj[id] = { name, points: 0 };
}

// ================= LEADERBOARD =================

async function updateLeaderboard() {
  try {
    if (!cup.leaderboardMessageId || !cup.leaderboardChannelId) return;

    const channel = await client.channels.fetch(cup.leaderboardChannelId);
    const msg = await channel.messages.fetch(cup.leaderboardMessageId);

    const gameKey = cup.currentGame || "overall";

    const data =
      gameKey === "overall"
        ? cup.overall
        : cup.games[gameKey]?.leaderboard || {};

    const sorted = Object.entries(data)
      .sort((a, b) => b[1].points - a[1].points);

    const perPage = 6;
    const maxPage = Math.max(0, Math.ceil(sorted.length / perPage) - 1);

    if (cup.page > maxPage) cup.page = maxPage;

    const start = cup.page * perPage;
    const slice = sorted.slice(start, start + perPage);

    initGame(gameKey);

    let desc = "";
    let lastPoints = null;
    let rank = start;

    slice.forEach(([id, player], i) => {
      if (i === 0) rank = start + 1;
      else if (player.points < lastPoints) rank++;

      lastPoints = player.points;

      const medal =
        rank === 1 ? "🥇" :
        rank === 2 ? "🥈" :
        rank === 3 ? "🥉" :
        `✨ ${rank}.`;

      const prev = cup.games[gameKey].previousRankings[id];
      let arrow = "";

      if (prev !== undefined) {
        if (prev > rank) arrow = "⬆️";
        else if (prev < rank) arrow = "⬇️";
        else arrow = "➡️";
      }

      cup.games[gameKey].previousRankings[id] = rank;

      desc += `${medal} ${arrow} <@${id}> • **${player.points} pts**\n`;
    });

    if (!desc) desc = "🌌 No competitors yet...";

    const embed = new EmbedBuilder()
      .setTitle(`✨ COSMIC CUP — ROUND ${cup.round} ✨`)
      .setDescription(desc)
      .setColor(0xA855F7)
      .setFooter({ text: `Page ${cup.page + 1}` });

    // DROPDOWN
    const options = [{ label: "🏆 Overall", value: "overall" }];
    for (const g of Object.keys(cup.games)) {
      options.push({ label: `🎮 ${g}`, value: g });
    }

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("leaderboard_select")
        .setPlaceholder("Select leaderboard")
        .addOptions(options)
    );

    // BUTTONS
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(cup.page === 0),

      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(cup.page >= maxPage)
    );

    await msg.edit({
      embeds: [embed],
      components: [selectRow, buttonRow]
    });

  } catch (err) {
    console.log("Leaderboard error:", err.message);
  }
}

// ================= EVENTS =================

client.on("interactionCreate", async (i) => {
  try {

    // ================= BUTTONS =================
    if (i.isButton()) {
      const gameKey = cup.currentGame || "overall";
      const data =
        gameKey === "overall"
          ? cup.overall
          : cup.games[gameKey]?.leaderboard || {};

      const maxPage = Math.max(0, Math.ceil(Object.keys(data).length / 6) - 1);

      if (i.customId === "next" && cup.page < maxPage) cup.page++;
      if (i.customId === "prev") cup.page = Math.max(0, cup.page - 1);

      await i.deferUpdate();
      return updateLeaderboard();
    }

    // ================= DROPDOWN =================
    if (i.isStringSelectMenu()) {
      cup.currentGame = i.values[0];
      cup.page = 0;

      initGame(cup.currentGame);
      cup.games[cup.currentGame].previousRankings = {};

      await i.deferUpdate();
      return updateLeaderboard();
    }

    // ================= SLASH =================
    if (!i.isChatInputCommand()) return;

    await i.deferReply();

    // ================= START =================
    if (i.commandName === "start") {
      if (!isRef(i.member))
        return i.editReply("Ref only");

      const game = i.options.getString("game");

      cup.round++; // ✅ NEW ROUND HERE
      cup.currentGame = game;
      cup.page = 0;

      initGame(game);

      let msg;

      // ✅ REUSE MESSAGE INSTEAD OF SPAMMING
      if (cup.leaderboardMessageId && cup.leaderboardChannelId) {
        const channel = await client.channels.fetch(cup.leaderboardChannelId);
        msg = await channel.messages.fetch(cup.leaderboardMessageId);
      } else {
        msg = await i.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 LIVE LEADERBOARD")
              .setDescription("🌌 Loading...")
          ]
        });

        cup.leaderboardMessageId = msg.id;
        cup.leaderboardChannelId = i.channel.id;
      }

      await i.editReply(`🚀 Round ${cup.round} started — ${game}`);
      return updateLeaderboard();
    }

    // ================= SCORE =================
    if (i.commandName === "score") {
      if (!isRef(i.member))
        return i.editReply("Ref only");

      const user = i.options.getUser("user");
      const pts = i.options.getInteger("points");

      const game = cup.currentGame;

      initGame(game);
      initPlayer(cup.games[game].leaderboard, user.id, user.username);
      initPlayer(cup.overall, user.id, user.username);

      cup.games[game].leaderboard[user.id].points += pts;
      cup.overall[user.id].points += pts;

      await i.editReply(`${user.username} +${pts} pts`);
      return updateLeaderboard();
    }
    
    // ================= END ROUND =================
if (i.commandName === "end") {
  if (!isRef(i.member))
    return i.editReply("Ref only");

  if (!cup.currentGame)
    return i.editReply("⚠️ No active round");

  const endedGame = cup.currentGame;

  // Optional: lock scoring by clearing currentGame
  cup.currentGame = null;

  await i.editReply(`🏁 Round ${cup.round} ended — ${endedGame}`);
  return;
}

    // ================= END CUP =================
    if (i.commandName === "end-cup") {
      const sorted = Object.entries(cup.overall)
        .sort((a, b) => b[1].points - a[1].points)
        .map(([id, p], i) => `${i + 1}. <@${id}> — ${p.points} pts`)
        .join("\n");

      return i.editReply(`🏆 FINAL RESULTS\n\n${sorted}`);
    }

  } catch (err) {
    console.log("Interaction error:", err);
  }
});

// ================= READY =================

client.once("clientReady", () => {
  console.log(`BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);