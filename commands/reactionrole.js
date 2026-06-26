const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      UNIQUE(message_id, emoji)
    )
  `);
}
initDB().catch(err => console.error('❌ ReactionRole DB init error:', err));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Link an emoji reaction on a message to a role')
        .addStringOption(opt => opt.setName('message_id').setDescription('ID of the message to add the reaction to').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji to react with (e.g. 🎮 or a custom emoji)').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give when someone reacts').setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel the message is in (leave empty for current channel)').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a reaction role link')
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji to remove').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all reaction roles in this server')
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();

    // ── ADD ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji').trim();
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      // Try to fetch the message to confirm it exists and add the reaction
      let targetMessage;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch {
        return interaction.reply({ content: '⚠️ Could not find that message. Make sure the message ID and channel are correct.', flags: 64 });
      }

      try {
        await pool.query(`
          INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (message_id, emoji) DO UPDATE SET role_id = $5
        `, [guild.id, channel.id, messageId, emoji, role.id]);
      } catch (err) {
        console.error('Failed to save reaction role:', err.message);
        return interaction.reply({ content: '❌ Failed to save reaction role.', flags: 64 });
      }

      // Add the reaction to the message so members know what to click
      try {
        await targetMessage.react(emoji);
      } catch {
        return interaction.reply({ content: `⚠️ Saved, but Oscar couldn't react with ${emoji} — make sure it's a valid emoji Oscar can use.`, flags: 64 });
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Reaction Role Added')
          .setColor(0x00cc66)
          .setDescription(`React with ${emoji} on [this message](${targetMessage.url}) to get <@&${role.id}>!`)]
      });
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji').trim();

      const { rowCount } = await pool.query(`
        DELETE FROM reaction_roles WHERE guild_id = $1 AND message_id = $2 AND emoji = $3
      `, [guild.id, messageId, emoji]);

      if (rowCount === 0) return interaction.reply({ content: '⚠️ No reaction role found for that message and emoji.', flags: 64 });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🗑️ Reaction Role Removed')
          .setColor(0xff4444)
          .setDescription(`The ${emoji} reaction role has been removed.`)]
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const { rows } = await pool.query(`SELECT * FROM reaction_roles WHERE guild_id = $1`, [guild.id]);

      if (rows.length === 0) return interaction.reply({ content: '📭 No reaction roles set up yet. Use `/reactionrole add` to get started.', flags: 64 });

      const lines = rows.map(r =>
        `${r.emoji} → <@&${r.role_id}> — [message](https://discord.com/channels/${guild.id}/${r.channel_id}/${r.message_id})`
      ).join('\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🎭 Reaction Roles')
          .setColor(0x5865f2)
          .setDescription(lines)]
      });
    }
  }
};