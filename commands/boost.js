const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boost_config (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      role_id TEXT,
      message TEXT DEFAULT 'Thank you so much for boosting the server, {user}! 🚀💜'
    )
  `);
}
initDB().catch(err => console.error('❌ Boost DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boost')
    .setDescription('Configure the boost thank you system')
    .setDescriptionLocalizations({
      'nl': 'Configureer het boost-bedanksysteem',
      'fr': 'Configurer le système de remerciement des boosts',
      'hi': 'बूस्ट धन्यवाद प्रणाली को कॉन्फ़िगर करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up the boost thank you system')
        .setDescriptionLocalizations({
          'nl': 'Stel het boost-bedanksysteem in',
          'fr': 'Configurer le système de remerciement des boosts',
          'hi': 'बूस्ट धन्यवाद प्रणाली सेट अप करें'
        })
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send boost messages in').setDescriptionLocalizations({ 'nl': 'Kanaal om boost-berichten in te sturen', 'fr': 'Canal pour envoyer les messages de boost', 'hi': 'बूस्ट संदेश भेजने के लिए चैनल' }).setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give to boosters automatically').setDescriptionLocalizations({ 'nl': 'Rol om automatisch aan boosters te geven', 'fr': 'Rôle à donner automatiquement aux boosters', 'hi': 'बूस्टर को स्वचालित रूप से देने के लिए भूमिका' }).setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Thank you message (use {user} for mention)').setDescriptionLocalizations({ 'nl': 'Bedankbericht (gebruik {user} voor vermelding)', 'fr': 'Message de remerciement (utilisez {user})', 'hi': 'धन्यवाद संदेश (मेंशन के लिए {user} का उपयोग करें)' }).setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current boost configuration')
        .setDescriptionLocalizations({
          'nl': 'Bekijk de huidige boost-configuratie',
          'fr': 'Afficher la configuration actuelle des boosts',
          'hi': 'वर्तमान बूस्ट कॉन्फ़िगरेशन देखें'
        })
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: t('en', 'guild_only'), flags: 64 });

    const lang = await getGuildLang(guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const message = interaction.options.getString('message') || t(lang, 'boost_default_msg', { guild: guild.name });

      await pool.query(`
        INSERT INTO boost_config (guild_id, channel_id, role_id, message)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id) DO UPDATE SET
          channel_id = $2,
          role_id = $3,
          message = $4
      `, [guild.id, channel.id, role.id, message]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(t(lang, 'boost_setup_title'))
          .setColor(0xff73fa)
          .addFields(
            { name: t(lang, 'boost_channel'), value: `<#${channel.id}>`, inline: true },
            { name: t(lang, 'boost_role'), value: `<@&${role.id}>`, inline: true },
            { name: t(lang, 'boost_message'), value: message }
          )]
      });
    }

    if (sub === 'config') {
      const { rows } = await pool.query(`SELECT * FROM boost_config WHERE guild_id = $1`, [guild.id]);
      const config = rows[0];

      if (!config) return interaction.reply({ content: t(lang, 'boost_not_configured'), flags: 64 });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(t(lang, 'boost_config_title'))
          .setColor(0xff73fa)
          .addFields(
            { name: t(lang, 'boost_channel'), value: `<#${config.channel_id}>`, inline: true },
            { name: t(lang, 'boost_role'), value: `<@&${config.role_id}>`, inline: true },
            { name: t(lang, 'boost_message'), value: config.message }
          )]
      });
    }
  }
};