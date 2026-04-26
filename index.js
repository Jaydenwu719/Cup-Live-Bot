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
  game: "none",
  round: 1,
  currentGame: "overall",
  overall: {},
  games: {},
  page: 0,
  leaderboardMessageId: null,
  leaderboardChannelId: null
};

// ================= EXPRESS API =================

app.get("/data", (req, res) => {
  res.json(cup);
});

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING:", PORT);
});

// ================= DISCORD =================

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

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
  if (!obj[id]) {
    obj[id] = { name, points: 0 };
  }
}

// ================= LEADERBOARD =================

async function updateLeaderboard() {
  try {
    if (!cup.leaderboardMessageId || !cup.leaderboardChannelId) return;

    const channel = await client.channels.fetch(cup.leaderboardChannelId);
    const msg = await channel.messages.fetch(cup.leaderboardMessageId);

    const gameKey = cup.currentGame;
    const dataSource =
      gameKey === "overall"
        ? cup.overall
        : cup.games[gameKey]?.leaderboard || {};

    const sorted = Object.entries(dataSource)
      .sort((a, b) => b[1].points - a[1].points);

    const perPage = 6;
    const start = cup.page * perPage;
    const slice = sorted.slice(start, start + perPage);

    initGame(gameKey);

    let desc = "";

    slice.forEach(([id, data], i) => {
      const rank = start + i + 1;

      let medal =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" :
        `✨ ${rank}.`;

      const prev = cup.games[gameKey].previousRankings[id];
      let arrow = "";

      if (prev !== undefined) {
        if (prev > rank) arrow = "⬆️";
        else if (prev < rank) arrow = "⬇️";
        else arrow = "➡️";
      }

      cup.games[gameKey].previousRankings[id] = rank;

      desc += `${medal} ${arrow} <@${id}> • **${data.points} pts**\n`;
    });

    if (!desc) desc = "🌌 No competitors yet...";

    const embed = new EmbedBuilder()
      .setTitle("✨ COSMIC CUP — LIVE ✨")
      .setDescription(
        `🎮 **${cup.currentGame}**\n\n━━━━━━━━━━━━━━\n${desc}\n━━━━━━━━━━━━━━`
      )
      .setColor(0xA855F7)
      .setFooter({ text: `Page ${cup.page + 1} • Round ${cup.round}` })
      .setTimestamp();

    const options = [
      {
        label: "🏆 Overall",
        value: "overall",
        description: "All games combined"
      }
    ];

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
    console.log("Leaderboard error:", err.message);
  }
}

// ================= INTERACTIONS =================

client.on("interactionCreate", async (i) => {
  try {

    // BUTTONS
    if (i.isButton()) {
      if (i.customId === "next") cup.page++;
      if (i.customId === "prev") cup.page = Math.max(0, cup.page - 1);

      await i.deferUpdate();
      await updateLeaderboard();
      return;
    }

    // DROPDOWN
    if (i.isStringSelectMenu()) {
      if (i.customId === "leaderboard_select") {
        cup.currentGame = i.values[0];
        cup.page = 0;

        initGame(cup.currentGame);
        cup.games[cup.currentGame].previousRankings = {};

        await i.deferUpdate();
        await updateLeaderboard();
        return;
      }
    }

    if (!i.isChatInputCommand()) return;

    // START
    if (i.commandName === "start") {
      if (!isRef(i.member))
        return i.reply({ content: "Ref only", ephemeral: true });

      const gameName = i.options.getString("game");

      cup.currentGame = gameName;
      cup.page = 0;

      initGame(gameName);

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

      await i.reply(`🏆 CUP STARTED\n🎮 ${gameName}`);
      await updateLeaderboard();
    }

    // SCORE
    if (i.commandName === "score") {
      if (!isRef(i.member))
        return i.reply({ content: "Ref only", ephemeral: true });

      const user = i.options.getUser("user");
      const pts = i.options.getInteger("points");

      const gameKey = cup.currentGame;

      initGame(gameKey);
      initPlayer(cup.games[gameKey].leaderboard, user.id, user.username);
      initPlayer(cup.overall, user.id, user.username);

      cup.games[gameKey].leaderboard[user.id].points += pts;
      cup.overall[user.id].points += pts;

      await i.reply(`📊 ${user.username} +${pts} pts`);
      await updateLeaderboard();
    }

  } catch (err) {
    console.log("Interaction error:", err);
  }
});

// ================= READY =================

client.once("ready", () => {
  console.log(`🏆 BOT ONLINE: ${client.user.tag}`);
});

client.login(TOKEN);