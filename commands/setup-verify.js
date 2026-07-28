const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verify_config (
      guild_id TEXT PRIMARY KEY,
      role_ids TEXT[] NOT NULL,
      unverified_role_id TEXT,
      log_channel_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initDB().catch(err => console.error('❌ Verify DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('Sets up the advanced verification message in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt => opt.setName('role1').setDescription('Role to give on verification').setRequired(true))
    .addRoleOption(opt => opt.setName('role2').setDescription('Additional role to give (optional)').setRequired(false))
    .addRoleOption(opt => opt.setName('role3').setDescription('Additional role to give (optional)').setRequired(false))
    .addRoleOption(opt => opt.setName('unverified_role').setDescription('Role to remove once verified (optional)').setRequired(false))
    .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel to log verifications (optional)').setRequired(false)),

  async execute(interaction) {
    const roles = ['role1', 'role2', 'role3']
      .map(key => interaction.options.getRole(key))
      .filter(Boolean);

    const unverifiedRole = interaction.options.getRole('unverified_role');
    const logChannel = interaction.options.getChannel('log_channel');

    await pool.query(`
      INSERT INTO verify_config (guild_id, role_ids, unverified_role_id, log_channel_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id) DO UPDATE SET
        role_ids = $2, unverified_role_id = $3, log_channel_id = $4, updated_at = NOW()
    `, [interaction.guild.id, roles.map(r => r.id), unverifiedRole?.id || null, logChannel?.id || null]);

    const roleList = roles.map(r => `🟢 ${r}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Server Verification')
      .setDescription(
        `Welcome to **${interaction.guild.name}**!\n\n` +
        `To keep this community safe and bot-free, we ask every member to verify themselves.\n\n` +
        `**How it works:**\n` +
        `Click the **Verify Me!** button below to instantly unlock the server and start chatting.`
      )
      .setColor(0x2B2D31)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }))
      .addFields({ name: '🔓 Roles you\'ll receive', value: roleList })
      .setImage('https://i.imgur.com/8bYqk3S.png') // subtle divider banner — safe to remove if unwanted
      .setFooter({ text: 'Secure Verification System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify Me!')
        .setEmoji('🔐')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: `✅ Verification message deployed with **${roles.length}** role${roles.length !== 1 ? 's' : ''} configured!`,
      flags: 64
    });
  },
};
