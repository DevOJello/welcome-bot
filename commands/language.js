const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change bot language / Verander de taal / Changer la langue / भाषा बदलें')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('lang')
        .setDescription('Choose a language / Kies een taal / Choisissez une langue / भाषा चुनें')
        .setRequired(true)
        .addChoices(
          { name: 'Nederlands 🇳🇱', value: 'nl' },
          { name: 'English 🇬🇧', value: 'en' },
          { name: 'Français 🇫🇷', value: 'fr' },
          { name: 'Hindi 🇮🇳', value: 'hi' }
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

    // Bepaal de juiste vertaalsleutel
    let key = 'lang_updated_en';
    if (lang === 'nl') key = 'lang_updated_nl';
    if (lang === 'fr') key = 'lang_updated_fr';
    if (lang === 'hi') key = 'lang_updated_hi'; // <-- Deze vangt het Hindi op!

    return interaction.reply({ content: t(lang, key), flags: 64 });
  }
};