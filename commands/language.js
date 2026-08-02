const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change bot language / Verander de taal van de bot / Changer la langue du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('lang')
        .setDescription('Choose a language / Kies een taal / Choisissez une langue')
        .setRequired(true)
        .addChoices(
          { name: 'Nederlands 🇳🇱', value: 'nl' },
          { name: 'English 🇬🇧', value: 'en' },
          { name: 'Français 🇫🇷', value: 'fr' }
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

    // Bepaal de juiste vertaalsleutel op basis van de gekozen taal
    let key = 'lang_updated_en';
    if (lang === 'nl') key = 'lang_updated_nl';
    if (lang === 'fr') key = 'lang_updated_fr';

    return interaction.reply({ content: t(lang, key), flags: 64 });
  }
};