require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;

// 🔴 PUT YOUR REAL DISCORD APPLICATION ID HERE
const CLIENT_ID = "1495186140435710032";

const commands = [

  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start CUP LIVE game')
    .addStringOption(option =>
      option.setName('game')
        .setDescription('Game name')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('bracket')
        .setDescription('Enable bracket mode')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('score')
    .setDescription('Add score or run bracket match')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Player')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('Points to add')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('against')
        .setDescription('Opponent (for bracket mode)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('end')
    .setDescription('End current round'),

  new SlashCommandBuilder()
    .setName('end-cup')
    .setDescription('End full cup and show results')

].map(cmd => cmd.toJSON());

// ================= REST =================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("🚀 Deploying slash commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Commands deployed successfully!");
  } catch (err) {
    console.error("❌ Deploy failed:", err);
  }
})();