const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🌠 STATE
let cup = {
  round: 1,
  game: null,
  active: false,
  locked: true,
  page: 0,
  messageId: null,
  channelId: null,

  scores: {},        // total cup scores
  roundScores: {},   // per round scores
  bracket: [],        // elimination list
  mvp: null
};

function safeUser(id) {
  if (!cup.scores[id]) cup.scores[id] = 0;
  if (!cup.roundScores[id]) cup.roundScores[id] = 0;
}

// 🧑‍⚖️ REF CHECK
function isRef(member) {
  return member.permissions.has("Administrator") ||
         member.permissions.has("ManageGuild");
}

// 🏆 INIT PLAYER
function ensurePlayer(id) {
  if (!cup.scores[id]) cup.scores[id] = 0;
  if (!cup.roundScores[id]) cup.roundScores[id] = 0;
}

// 🌟 AUTO MVP DETECTION
function calculateMVP() {
  let bestId = null;
  let bestScore = -1;

  for (const [id, pts] of Object.entries(cup.roundScores)) {
    if (pts > bestScore) {
      bestScore = pts;
      bestId = id;
    }
  }

  cup.mvp = bestId;
}

// 🏟 BRACKET UPDATE (SIMPLE ELIMINATION)
function updateBracket() {
  const sorted = Object.entries(cup.scores)
    .sort((a, b) => b[1] - a[1]);

  // keep top 50% alive
  const cut = Math.ceil(sorted.length / 2);

  cup.bracket = sorted.slice(0, cut).map(x => x[0]);
}

// ✨ GLOW EFFECT (TEXT EMULATION)
function glow(text) {
  return `✨ **${text}** ✨`;
}

// 📊 LEADERBOARD
function buildLeaderboard(page = 0) {
  const sorted = Object.entries(cup.scores)
    .sort((a, b) => b[1] - a[1]);

  const perPage = 6;
  const start = page * perPage;
  const slice = sorted.slice(start, start + perPage);

  let desc = "";

  if (!slice.length) {
    desc = "🌌 No competitors yet...\n";
  } else {
    slice.forEach(([id, pts], i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${start + i + 1}`;
      desc += `${medal} <@${id}> • **${pts} pts**\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(glow(`COSMIC CUP — ROUND ${cup.round}`))
    .setDescription(
      `🎮 Game: **${cup.game || "None"}**\n\n` +
      `━━━━━━━━━━━━━━\n` +
      desc +
      `━━━━━━━━━━━━━━\n\n` +
      `👑 MVP (Round): ${cup.mvp ? `<@${cup.mvp}>` : "None"}`
    )
    .setColor(0xA855F7)
    .setFooter({ text: "Cosmic Cup • Live Esports System" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

// 🔄 UPDATE MESSAGE
async function updateLeaderboard() {
  try {
    if (!cup.messageId) return;

    const channel = await client.channels.fetch(cup.channelId);
    const msg = await channel.messages.fetch(cup.messageId);

    const { embed, row } = buildLeaderboard(cup.page);

    await msg.edit({ embeds: [embed], components: [row] });
  } catch (err) {
    console.log("⚠️ leaderboard update failed:", err.message);
  }
}

// 🤖 READY
client.once('ready', () => {
  console.log(`🌠 Cosmic Cup V3 ONLINE as ${client.user.tag}`);
  console.log("🏆 Cup system fully loaded");
  console.log("📊 Leaderboard active");
});

client.on('interactionCreate', async interaction => {

  // ================= COMMANDS =================
  if (interaction.isChatInputCommand()) {

    // 🚀 START
    if (interaction.commandName === 'start') {

      if (!isRef(interaction.member))
        return interaction.reply({ content: "🚫 Ref only", ephemeral: true });

      cup.game = interaction.options.getString('game');
      cup.active = true;
      cup.locked = false;
      cup.page = 0;

      const { embed, row } = buildLeaderboard(0);

      const msg = await interaction.reply({
        content: glow(`ROUND ${cup.round} STARTED`),
        embeds: [embed],
        components: [row],
        fetchReply: true
      });

      cup.messageId = msg.id;
      cup.channelId = interaction.channel.id;
    }

    // 🏆 SCORE
    if (interaction.commandName === 'score') {

      if (!isRef(interaction.member))
        return interaction.reply({ content: "🚫 Ref only", ephemeral: true });

      if (!cup.active || cup.locked)
        return interaction.reply({ content: "🔒 Locked", ephemeral: true });

      const user = interaction.options.getUser('user');
      const pts = interaction.options.getInteger('points');

      safeUser(user.id);

      cup.scores[user.id] += pts;
      cup.roundScores[user.id] = (cup.roundScores[user.id] || 0) + pts;

      calculateMVP();
      await updateLeaderboard();

      return interaction.reply(`+${pts} → ${user.username}`);
    }

    // 🏁 END
    if (interaction.commandName === 'end') {

      calculateMVP();
      updateBracket();

      cup.roundScores = {};
      cup.round++;
      cup.locked = false;
      cup.mvp = null;

      return interaction.reply(
        `🏁 Round ended\n👑 MVP: None\n🏟 Bracket updated`
      );
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    if (interaction.customId === 'next') cup.page++;
    if (interaction.customId === 'prev') cup.page = Math.max(0, cup.page - 1);

    cup.page = Math.max(0, cup.page);

    await updateLeaderboard();

    return interaction.deferUpdate();
  }

});

// ================= PAGINATION =================
client.on('interactionCreate', async interaction => {

  if (!interaction.isButton()) return;

if (interaction.customId === 'next') {
  cup.page++;
}

if (interaction.customId === 'prev') {
  cup.page = Math.max(0, cup.page - 1);
}

// safety clamp
cup.page = Math.max(0, cup.page);

  await updateLeaderboard();

  return interaction.deferUpdate();
});

// ================= Render Approved =================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("🏆 CUP LIVE BOT RUNNING");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Web server running on", PORT);
});

client.login(TOKEN);