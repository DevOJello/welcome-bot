const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const pool = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change bot language')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('lang')
        .setDescription('Choose a language')
        .setRequired(true)
        .addChoices(
          { name: 'Nederlands 🇳🇱', value: 'nl' },
          { name: 'English 🇬🇧', value: 'en' }
        )
    ),

  async execute(interaction) {
    const lang = interaction.options.getString('lang');
    const guildId = interaction.guildId;

    // Opslaan in database
    await pool.query(
      `INSERT INTO guild_settings (guild_id, language) 
       VALUES ($1, $2) 
       ON CONFLICT (guild_id) DO UPDATE SET language = $2`,
      [guildId, lang]
    );

    const msg = lang === 'nl' 
      ? '✅ De taal van de bot is succesvol ingesteld op **Nederlands**!' 
      : '✅ The bot language has been successfully set to **English**!';

    return interaction.reply({ content: msg, flags: 64 });
  }
};
