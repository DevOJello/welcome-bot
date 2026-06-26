const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS welcome_config (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      role_id TEXT,
      dm_message TEXT DEFAULT 'Welcome to the server! We''re glad to have you here. 🎉',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initDB().catch(err => console.error('❌ Welcome DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up the welcome system for this server')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send welcome messages in').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give new members automatically').setRequired(true))
        .addStringOption(opt => opt.setName('dm').setDescription('DM message sent to new members (use {user} for their name)').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View the current welcome configuration')
    )

    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Test the welcome message with your own account')
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();

    // ── SETUP ────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const dm = interaction.options.getString('dm') || `Welcome to **${guild.name}**, {user}! We're glad to have you here. 🎉`;

      await pool.query(`
        INSERT INTO welcome_config (guild_id, channel_id, role_id, dm_message)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id) DO UPDATE SET
          channel_id = $2,
          role_id = $3,
          dm_message = $4,
          updated_at = NOW()
      `, [guild.id, channel.id, role.id, dm]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Welcome System Configured!')
          .setColor(0x00ff00)
          .addFields(
            { name: '📢 Welcome Channel', value: `<#${channel.id}>`, inline: true },
            { name: '🎭 Auto Role', value: `<@&${role.id}>`, inline: true },
            { name: '📩 DM Message', value: dm },
          )]
      });
    }

    // ── CONFIG ───────────────────────────────────────────────────────────────
    if (sub === 'config') {
      const { rows } = await pool.query(`SELECT * FROM welcome_config WHERE guild_id = $1`, [guild.id]);
      const config = rows[0];

      if (!config) {
        return interaction.reply({ content: '⚠️ Welcome system not set up yet. Use `/welcome setup` first.', flags: 64 });
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('⚙️ Welcome Configuration')
          .setColor(0x6C63FF)
          .addFields(
            { name: '📢 Welcome Channel', value: `<#${config.channel_id}>`, inline: true },
            { name: '🎭 Auto Role', value: `<@&${config.role_id}>`, inline: true },
            { name: '📩 DM Message', value: config.dm_message },
          )]
      });
    }

    // ── TEST ─────────────────────────────────────────────────────────────────
    if (sub === 'test') {
      const { rows } = await pool.query(`SELECT * FROM welcome_config WHERE guild_id = $1`, [guild.id]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Welcome system not set up yet. Use `/welcome setup` first.', flags: 64 });

      await interaction.reply({ content: '✅ Sending a test welcome message...', flags: 64 });

      // Fire the guildMemberAdd handler with the interaction user as if they just joined
      client.emit('guildMemberAdd', await guild.members.fetch(interaction.user.id));
    }
  }
};