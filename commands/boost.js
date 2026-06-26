const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up the boost thank you system')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send boost messages in').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give to boosters automatically').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Thank you message (use {user} for mention)').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current boost configuration')
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const message = interaction.options.getString('message') || `Thank you so much for boosting **${guild.name}**, {user}! 🚀💜`;

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
          .setTitle('✅ Boost System Configured!')
          .setColor(0xff73fa)
          .addFields(
            { name: '📢 Boost Channel', value: `<#${channel.id}>`, inline: true },
            { name: '🎭 Booster Role', value: `<@&${role.id}>`, inline: true },
            { name: '💬 Message', value: message },
          )]
      });
    }

    if (sub === 'config') {
      const { rows } = await pool.query(`SELECT * FROM boost_config WHERE guild_id = $1`, [guild.id]);
      const config = rows[0];

      if (!config) return interaction.reply({ content: '⚠️ Boost system not set up yet. Use `/boost setup` first.', flags: 64 });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('⚙️ Boost Configuration')
          .setColor(0xff73fa)
          .addFields(
            { name: '📢 Boost Channel', value: `<#${config.channel_id}>`, inline: true },
            { name: '🎭 Booster Role', value: `<@&${config.role_id}>`, inline: true },
            { name: '💬 Message', value: config.message },
          )]
      });
    }
  }
};