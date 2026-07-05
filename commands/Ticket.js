const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const pool = require('../database');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_config (
      guild_id TEXT PRIMARY KEY,
      category_id TEXT,
      transcript_channel_id TEXT,
      staff_role_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initDB().catch(err => console.error('❌ Ticket DB init error:', err));

async function getConfig(guildId) {
  const { rows } = await pool.query(`SELECT * FROM ticket_config WHERE guild_id = $1`, [guildId]);
  return rows[0] || null;
}

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();
  const lines = sorted.map(m =>
    `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '[attachment/embed]'}`
  ).join('\n');
  return lines || 'No messages found.';
}

async function closeTicket(interaction, channelId, channel, guild) {
  const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id = $1 AND status = 'open'`, [channelId]);
  if (rows.length === 0) return interaction.reply({ content: '⚠️ This ticket is already closed.', flags: 64 });

  const ticket = rows[0];
  const config = await getConfig(guild.id);

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xff4444)
      .setDescription('🔒 Closing ticket and saving transcript...')
    ]
  });

  // Save transcript
  if (config?.transcript_channel_id) {
    try {
      const transcript = await generateTranscript(channel);
      const transcriptChannel = guild.channels.cache.get(config.transcript_channel_id);
      if (transcriptChannel) {
        const buffer = Buffer.from(transcript, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `ticket-${channelId}.txt` });
        await transcriptChannel.send({
          embeds: [new EmbedBuilder()
            .setTitle('📋 Ticket Transcript')
            .setColor(0x5865f2)
            .addFields(
              { name: '👤 Opened by', value: `<@${ticket.user_id}>`, inline: true },
              { name: '🔒 Closed by', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setTimestamp()],
          files: [attachment]
        });
      }
    } catch (err) {
      console.error('Failed to save transcript:', err.message);
    }
  }

  await pool.query(`UPDATE tickets SET status = 'closed' WHERE channel_id = $1`, [channelId]);

  setTimeout(async () => {
    try { await channel.delete(); } catch {}
  }, 5000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set up the ticket system')
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Role that can see and manage tickets').setRequired(true))
        .addChannelOption(opt => opt.setName('transcript_channel').setDescription('Channel to save ticket transcripts').setRequired(true))
        .addChannelOption(opt => opt.setName('category').setDescription('Category to create ticket channels in').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Send the ticket panel with a button to a channel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send the panel in').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Custom message on the panel').setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket')
    )

    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const sub = interaction.options.getSubcommand();

    // ── SETUP ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const staffRole = interaction.options.getRole('staff_role');
      const transcriptChannel = interaction.options.getChannel('transcript_channel');
      const category = interaction.options.getChannel('category');

      await pool.query(`
        INSERT INTO ticket_config (guild_id, staff_role_id, transcript_channel_id, category_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id) DO UPDATE SET
          staff_role_id = $2, transcript_channel_id = $3, category_id = $4, updated_at = NOW()
      `, [guild.id, staffRole.id, transcriptChannel.id, category?.id || null]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Ticket System Configured!')
          .setColor(0x00cc66)
          .addFields(
            { name: '👥 Staff Role', value: `<@&${staffRole.id}>`, inline: true },
            { name: '📋 Transcript Channel', value: `<#${transcriptChannel.id}>`, inline: true },
            { name: '📁 Category', value: category ? category.name : 'Default', inline: true },
          )]
      });
    }

    // ── PANEL ─────────────────────────────────────────────────────────────────
    if (sub === 'panel') {
      const config = await getConfig(guild.id);
      if (!config) return interaction.reply({ content: '⚠️ Set up the ticket system first with `/ticket setup`.', flags: 64 });

      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || 'Need help? Click the button below to open a support ticket and our team will assist you as soon as possible.';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_create_${guild.id}`)
          .setLabel('Open a Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('🎫 Support Tickets')
          .setColor(0x5865f2)
          .setDescription(message)
          .setFooter({ text: 'One ticket per person • Misuse may result in a ban' })],
        components: [row]
      });

      return interaction.reply({ content: `✅ Ticket panel sent to <#${channel.id}>!`, flags: 64 });
    }

    // ── CLOSE ─────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      await closeTicket(interaction, interaction.channelId, interaction.channel, guild);
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id = $1 AND status = 'open'`, [interaction.channelId]);
      if (rows.length === 0) return interaction.reply({ content: '⚠️ This is not an active ticket channel.', flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00cc66)
          .setDescription(`✅ <@${user.id}> has been added to this ticket.`)]
      });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id = $1 AND status = 'open'`, [interaction.channelId]);
      if (rows.length === 0) return interaction.reply({ content: '⚠️ This is not an active ticket channel.', flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setDescription(`✅ <@${user.id}> has been removed from this ticket.`)]
      });
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.isButton()) return;

    // ── CLOSE BUTTON ─────────────────────────────────────────────────────────
    if (interaction.customId.startsWith('ticket_close_')) {
      const channelId = interaction.customId.replace('ticket_close_', '');
      await closeTicket(interaction, channelId, interaction.channel, interaction.guild);
      return;
    }

    // ── CREATE BUTTON ─────────────────────────────────────────────────────────
    if (!interaction.customId.startsWith('ticket_create_')) return;

    const guildId = interaction.customId.replace('ticket_create_', '');
    const guild = interaction.guild;
    const user = interaction.user;

    const config = await getConfig(guildId);
    if (!config) return interaction.reply({ content: '⚠️ Ticket system not configured.', flags: 64 });

    const { rows: existing } = await pool.query(`
      SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'
    `, [guildId, user.id]);

    if (existing.length > 0) {
      return interaction.reply({
        content: `⚠️ You already have an open ticket: <#${existing[0].channel_id}>`,
        flags: 64
      });
    }

    const channelOptions = {
      name: `🎫・${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      topic: `Ticket opened by ${user.tag}`,
      permissionOverwrites: [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
      ]
    };

    if (config.staff_role_id) {
      channelOptions.permissionOverwrites.push({
        id: config.staff_role_id,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages', 'AttachFiles']
      });
    }

    if (config.category_id) channelOptions.parent = config.category_id;

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create(channelOptions);
    } catch (err) {
      console.error('Failed to create ticket channel:', err.message);
      return interaction.reply({ content: '❌ Failed to create ticket channel. Check my permissions.', flags: 64 });
    }

    await pool.query(`INSERT INTO tickets (guild_id, channel_id, user_id) VALUES ($1, $2, $3)`, [guildId, ticketChannel.id, user.id]);

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketChannel.id}`)
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `<@${user.id}>${config.staff_role_id ? ` <@&${config.staff_role_id}>` : ''}`,
      embeds: [new EmbedBuilder()
        .setTitle('🎫 Support Ticket')
        .setColor(0x5865f2)
        .setDescription(`Hey <@${user.id}>, welcome to your ticket!\n\nPlease describe your issue in as much detail as possible and our team will assist you shortly.`)
        .addFields(
          { name: '👤 Opened by', value: `<@${user.id}>`, inline: true },
          { name: '📅 Opened at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        )
        .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }))
        .setFooter({ text: 'Click the button below to close this ticket' })],
      components: [closeRow]
    });

    return interaction.reply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>`, flags: 64 });
  }
};
