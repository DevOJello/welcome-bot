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
      claimed_by TEXT,
      status TEXT DEFAULT 'open',
      closed_at TIMESTAMPTZ,
      closed_by TEXT,
      rating INTEGER,
      rated_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS claimed_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating INTEGER`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rated_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rating_blacklist (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      banned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  // Add rating columns to staff_stats if they exist
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0`).catch(() => {});
}
initDB().catch(err => console.error('❌ Ticket DB init error:', err));

async function getConfig(guildId) {
  const { rows } = await pool.query(`SELECT * FROM ticket_config WHERE guild_id = $1`, [guildId]);
  return rows[0] || null;
}

async function generateTranscript(channel) {
  let allMessages = [];
  let lastId = null;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    allMessages = allMessages.concat([...batch.values()]);
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }
  const sorted = allMessages.reverse();
  const header = `Ticket Transcript — #${channel.name}\nTotal messages: ${sorted.length}\n${'─'.repeat(50)}\n\n`;
  const lines = sorted.map(m => {
    const time = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const parts = [];
    if (m.content) parts.push(m.content);
    if (m.attachments.size > 0) parts.push(`[${m.attachments.size} attachment(s): ${[...m.attachments.values()].map(a => a.url).join(' | ')}]`);
    if (m.embeds.length > 0) parts.push(`[${m.embeds.length} embed(s): ${m.embeds.map(e => e.title || e.description?.slice(0, 50) || 'embed').join(' | ')}]`);
    return `[${time}] ${m.author.tag}: ${parts.join(' ') || '[empty]'}`;
  }).join('\n');
  return header + (lines || 'No messages.');
}

async function saveTranscriptAndDelete(channel, guild, ticket, closedById, client) {
  const config = await getConfig(guild.id);
  if (config?.transcript_channel_id) {
    try {
      const transcript = await generateTranscript(channel);
      const transcriptChannel = guild.channels.cache.get(config.transcript_channel_id);
      if (transcriptChannel) {
        const buffer = Buffer.from(transcript, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `ticket-${ticket.id}-${channel.name}.txt` });
        let closedByUser;
        try { closedByUser = await client.users.fetch(closedById || ticket.closed_by); } catch {}
        let claimedByUser;
        if (ticket.claimed_by) { try { claimedByUser = await client.users.fetch(ticket.claimed_by); } catch {} }
        await transcriptChannel.send({
          embeds: [new EmbedBuilder()
            .setTitle('📋 Ticket Transcript')
            .setColor(0x5865f2)
            .addFields(
              { name: '🎫 Ticket', value: `#${channel.name}`, inline: true },
              { name: '👤 Opened by', value: `<@${ticket.user_id}>`, inline: true },
              { name: '🔒 Closed by', value: closedByUser ? `<@${closedByUser.id}>` : 'Unknown', inline: true },
              { name: '🛡️ Claimed by', value: claimedByUser ? `<@${claimedByUser.id}>` : '*Unclaimed*', inline: true },
              { name: '⭐ Rating', value: ticket.rating ? `${'⭐'.repeat(ticket.rating)} (${ticket.rating}/5)` : '*No rating yet*', inline: true },
              { name: '📅 Opened', value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`, inline: true },
            )
            .setTimestamp()],
          files: [attachment]
        });
      }
    } catch (err) {
      console.error('Failed to save transcript:', err.message);
    }
  }

  // DM the user for a rating if ticket was claimed
  if (ticket.claimed_by && ticket.user_id) {
    try {
      const ticketUser = await client.users.fetch(ticket.user_id);
      // Check not blacklisted
      const { rows: bl } = await pool.query(`SELECT 1 FROM rating_blacklist WHERE user_id = $1 AND guild_id = $2`, [ticket.user_id, guild.id]);
      if (bl.length === 0) {
        const ratingRow = new ActionRowBuilder().addComponents(
          ...[1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
              .setCustomId(`ticket_rate_${ticket.id}_${n}`)
              .setLabel('⭐'.repeat(n))
              .setStyle(n <= 2 ? ButtonStyle.Danger : n === 3 ? ButtonStyle.Secondary : ButtonStyle.Success)
          )
        );
        await ticketUser.send({
          embeds: [new EmbedBuilder()
            .setTitle('⭐ Rate your support experience')
            .setColor(0xffd700)
            .setDescription(`Your ticket in **${guild.name}** has been closed.\n\nHow would you rate the support you received from <@${ticket.claimed_by}>?\n\nClick a star rating below:`)
            .setFooter({ text: 'Your feedback helps us improve!' })],
          components: [ratingRow]
        });
        // Store ticket id in DB so we can find it from the button
        await pool.query(`UPDATE tickets SET status = 'awaiting_rating', closed_by = $1 WHERE id = $2`, [closedById, ticket.id]);
        // Delete channel after short delay
        setTimeout(async () => { try { await channel.delete(); } catch {} }, 5000);
        return; // Don't mark as deleted yet — wait for rating
      }
    } catch (err) {
      console.error('Failed to DM rating request:', err.message);
    }
  }

  await pool.query(`UPDATE tickets SET status = 'deleted', closed_by = $1 WHERE id = $2`, [closedById, ticket.id]);
  setTimeout(async () => { try { await channel.delete(); } catch {} }, 5000);
}

// ── Scheduler: auto-delete tickets closed for 24h ────────────────────────────
let schedulerClient = null;
setInterval(async () => {
  if (!schedulerClient) return;
  try {
    const { rows } = await pool.query(`
      SELECT t.* FROM tickets t
      WHERE t.status = 'closed' AND t.closed_at <= NOW() - INTERVAL '24 hours'
    `);
    for (const ticket of rows) {
      try {
        const guild = schedulerClient.guilds.cache.get(ticket.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(ticket.channel_id);
        if (!channel) { await pool.query(`UPDATE tickets SET status = 'deleted' WHERE id = $1`, [ticket.id]); continue; }
        await saveTranscriptAndDelete(channel, guild, ticket, null, schedulerClient);
      } catch (err) {
        console.error(`[Tickets] Auto-delete error for ticket ${ticket.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Tickets] Scheduler error:', err.message);
  }
}, 5 * 60 * 1000);

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
      sub.setName('claim')
        .setDescription('Claim this ticket as your responsibility')
    )
    .addSubcommand(sub =>
      sub.setName('unclaim')
        .setDescription('Unclaim this ticket')
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
    )
    .addSubcommand(sub =>
      sub.setName('ratingban')
        .setDescription('Remove a user\'s right to give star ratings')
        .addUserOption(opt => opt.setName('user').setDescription('User to ban from rating').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ratingunban')
        .setDescription('Restore a user\'s right to give star ratings')
        .addUserOption(opt => opt.setName('user').setDescription('User to restore').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ratings')
        .setDescription('View star rating stats for a staff member')
        .addUserOption(opt => opt.setName('staff').setDescription('Staff member to check').setRequired(true))
    ),

  async execute(interaction, client) {
    schedulerClient = client;
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });
    const sub = interaction.options.getSubcommand();

    // ── SETUP ────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const staffRole = interaction.options.getRole('staff_role');
      const transcriptChannel = interaction.options.getChannel('transcript_channel');
      const category = interaction.options.getChannel('category');
      await pool.query(`
        INSERT INTO ticket_config (guild_id, staff_role_id, transcript_channel_id, category_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id) DO UPDATE SET staff_role_id=$2, transcript_channel_id=$3, category_id=$4, updated_at=NOW()
      `, [guild.id, staffRole.id, transcriptChannel.id, category?.id || null]);
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('✅ Ticket System Configured!').setColor(0x00cc66)
          .addFields(
            { name: '👥 Staff Role', value: `<@&${staffRole.id}>`, inline: true },
            { name: '📋 Transcript Channel', value: `<#${transcriptChannel.id}>`, inline: true },
            { name: '📁 Category', value: category ? category.name : 'Default', inline: true },
          )]
      });
    }

    // ── PANEL ────────────────────────────────────────────────────────────────
    if (sub === 'panel') {
      const config = await getConfig(guild.id);
      if (!config) return interaction.reply({ content: '⚠️ Set up with `/ticket setup` first.', flags: 64 });
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || 'Need help? Click the button below to open a support ticket.';
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_create_${guild.id}`).setLabel('Open a Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
      );
      await channel.send({
        embeds: [new EmbedBuilder().setTitle('🎫 Support Tickets').setColor(0x5865f2).setDescription(message)
          .setFooter({ text: 'One ticket per person • Misuse may result in a ban' })],
        components: [row]
      });
      return interaction.reply({ content: `✅ Panel sent to <#${channel.id}>!`, flags: 64 });
    }

    // ── CLAIM ────────────────────────────────────────────────────────────────
    if (sub === 'claim') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ This is not an active ticket channel.', flags: 64 });
      const ticket = rows[0];
      if (ticket.claimed_by) return interaction.reply({ content: `⚠️ This ticket is already claimed by <@${ticket.claimed_by}>.`, flags: 64 });
      await pool.query(`UPDATE tickets SET claimed_by=$1 WHERE id=$2`, [interaction.user.id, ticket.id]);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00cc66)
          .setDescription(`✅ <@${interaction.user.id}> has claimed this ticket and is now handling it.\n\nOther staff can relax — this one's covered!`)]
      });
    }

    // ── UNCLAIM ──────────────────────────────────────────────────────────────
    if (sub === 'unclaim') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ This is not an active ticket channel.', flags: 64 });
      await pool.query(`UPDATE tickets SET claimed_by=NULL WHERE id=$1`, [rows[0].id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff9900).setDescription(`🔓 Ticket unclaimed — available for any staff to take.`)] });
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ This is not an active ticket channel.', flags: 64 });
      const ticket = rows[0];
      const config = await getConfig(guild.id);
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false }); } catch {}
      await pool.query(`UPDATE tickets SET status='closed', closed_at=NOW(), closed_by=$1 WHERE id=$2`, [interaction.user.id, ticket.id]);
      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, guild.id, 'tickets_closed');
      } catch {}
      const deleteTime = Math.floor(Date.now() / 1000) + 86400;
      const reopenRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_reopen_${interaction.channelId}`).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_delete_${interaction.channelId}`).setLabel('Delete Now').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🔒 Ticket Closed').setColor(0xff4444)
          .setDescription(
            `Closed by <@${interaction.user.id}>.\n` +
            (ticket.claimed_by ? `🛡️ Was handled by <@${ticket.claimed_by}>\n` : '') +
            `\nThe opener can no longer see this channel.\n🗑️ Auto-deletes <t:${deleteTime}:R> unless reopened.`
          )
          .setFooter({ text: 'Only staff can see this channel now' })],
        components: [reopenRow]
      });
    }

    // ── ADD / REMOVE ─────────────────────────────────────────────────────────
    if (sub === 'add') {
      const { rows } = await pool.query(`SELECT 1 FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Not an active ticket.', flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00cc66).setDescription(`✅ <@${user.id}> added to this ticket.`)] });
    }
    if (sub === 'remove') {
      const { rows } = await pool.query(`SELECT 1 FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Not an active ticket.', flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`✅ <@${user.id}> removed from this ticket.`)] });
    }

    // ── RATING BAN / UNBAN ────────────────────────────────────────────────────
    if (sub === 'ratingban') {
      const user = interaction.options.getUser('user');
      await pool.query(`INSERT INTO rating_blacklist (user_id, guild_id, banned_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [user.id, guild.id, interaction.user.id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`🚫 <@${user.id}> can no longer give star ratings.`)] });
    }
    if (sub === 'ratingunban') {
      const user = interaction.options.getUser('user');
      await pool.query(`DELETE FROM rating_blacklist WHERE user_id=$1 AND guild_id=$2`, [user.id, guild.id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00cc66).setDescription(`✅ <@${user.id}> can give star ratings again.`)] });
    }

    // ── RATINGS ──────────────────────────────────────────────────────────────
    if (sub === 'ratings') {
      const staff = interaction.options.getUser('staff');
      const { rows: statsRows } = await pool.query(`SELECT total_ratings, rating_sum FROM staff_stats WHERE user_id=$1 AND guild_id=$2`, [staff.id, guild.id]);
      const stats = statsRows[0] || { total_ratings: 0, rating_sum: 0 };
      const avg = stats.total_ratings > 0 ? (stats.rating_sum / stats.total_ratings).toFixed(2) : 'N/A';
      const stars = stats.total_ratings > 0 ? '⭐'.repeat(Math.round(stats.rating_sum / stats.total_ratings)) : 'No ratings yet';
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`⭐ Rating Stats — ${staff.username}`)
          .setColor(0xffd700)
          .setThumbnail(staff.displayAvatarURL({ extension: 'png' }))
          .addFields(
            { name: '⭐ Average Rating', value: `${avg}/5 ${stars}`, inline: true },
            { name: '📊 Total Ratings', value: `${stats.total_ratings}`, inline: true },
          )
          .setTimestamp()]
      });
    }
  },

  async handleButton(interaction, client) {
    if (!interaction.isButton()) return;
    schedulerClient = client;
    const guild = interaction.guild;

    // ── REOPEN ───────────────────────────────────────────────────────────────
    if (interaction.customId.startsWith('ticket_reopen_')) {
      const channelId = interaction.customId.replace('ticket_reopen_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='closed'`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Cannot reopen.', flags: 64 });
      const ticket = rows[0];
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); } catch {}
      await pool.query(`UPDATE tickets SET status='open', closed_at=NULL WHERE channel_id=$1`, [channelId]);
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_btn_${channelId}`).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x00cc66)
          .setTitle('🔓 Ticket Reopened')
          .setDescription(`Reopened by <@${interaction.user.id}>. <@${ticket.user_id}> can see this channel again.`)],
        components: [closeRow]
      });
    }

    // ── DELETE NOW ────────────────────────────────────────────────────────────
    if (interaction.customId.startsWith('ticket_delete_')) {
      const channelId = interaction.customId.replace('ticket_delete_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Ticket not found.', flags: 64 });
      await interaction.update({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription('🗑️ Saving transcript and deleting...')], components: [] });
      await saveTranscriptAndDelete(interaction.channel, guild, rows[0], interaction.user.id, client);
      return;
    }

    // ── CLOSE BUTTON ──────────────────────────────────────────────────────────
    if (interaction.customId.startsWith('ticket_close_btn_')) {
      const channelId = interaction.customId.replace('ticket_close_btn_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Already closed.', flags: 64 });
      const ticket = rows[0];
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false }); } catch {}
      await pool.query(`UPDATE tickets SET status='closed', closed_at=NOW(), closed_by=$1 WHERE channel_id=$2`, [interaction.user.id, channelId]);
      try { const { incrementStat } = require('./staffstats'); await incrementStat(interaction.user.id, guild.id, 'tickets_closed'); } catch {}
      const deleteTime = Math.floor(Date.now() / 1000) + 86400;
      const reopenRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_reopen_${channelId}`).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_delete_${channelId}`).setLabel('Delete Now').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('🔒 Ticket Closed').setColor(0xff4444)
          .setDescription(
            `Closed by <@${interaction.user.id}>.\n` +
            (ticket.claimed_by ? `🛡️ Was handled by <@${ticket.claimed_by}>\n` : '') +
            `\nOpener can no longer see this channel.\n🗑️ Auto-deletes <t:${deleteTime}:R> unless reopened.`
          )
          .setFooter({ text: 'Only staff can see this channel now' })],
        components: [reopenRow]
      });
    }

    // ── STAR RATING ───────────────────────────────────────────────────────────
    if (interaction.customId.startsWith('ticket_rate_')) {
      const parts = interaction.customId.split('_');
      const ticketId = parseInt(parts[2]);
      const rating = parseInt(parts[3]);

      const { rows } = await pool.query(`SELECT * FROM tickets WHERE id=$1`, [ticketId]);
      if (!rows[0]) return interaction.reply({ content: '⚠️ Ticket not found.', flags: 64 });
      const ticket = rows[0];

      if (ticket.rating) return interaction.reply({ content: '⚠️ You already rated this ticket.', flags: 64 });
      if (interaction.user.id !== ticket.user_id) return interaction.reply({ content: '⚠️ Only the ticket opener can rate.', flags: 64 });

      // Check blacklist — but this is in DMs so guild is null, use ticket.guild_id
      const { rows: bl } = await pool.query(`SELECT 1 FROM rating_blacklist WHERE user_id=$1 AND guild_id=$2`, [interaction.user.id, ticket.guild_id]);
      if (bl.length > 0) return interaction.reply({ content: '⚠️ You are not allowed to give ratings.', flags: 64 });

      await pool.query(`UPDATE tickets SET rating=$1, rated_by=$2, status='deleted' WHERE id=$3`, [rating, interaction.user.id, ticketId]);

      // Update staff stats
      if (ticket.claimed_by) {
        await pool.query(`
          INSERT INTO staff_stats (user_id, guild_id, total_ratings, rating_sum)
          VALUES ($1, $2, 1, $3)
          ON CONFLICT (user_id, guild_id) DO UPDATE SET
            total_ratings = staff_stats.total_ratings + 1,
            rating_sum = staff_stats.rating_sum + $3
        `, [ticket.claimed_by, ticket.guild_id, rating]);
      }

      const stars = '⭐'.repeat(rating);
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setTitle('⭐ Thank you for your feedback!')
          .setColor(rating >= 4 ? 0x2ecc71 : rating === 3 ? 0xff9900 : 0xe74c3c)
          .setDescription(`You rated your support experience **${stars} (${rating}/5)**.\n\nYour feedback helps us improve our team!`)],
        components: []
      });
      return;
    }

    // ── CREATE BUTTON ─────────────────────────────────────────────────────────
    if (!interaction.customId.startsWith('ticket_create_')) return;
    const guildId = interaction.customId.replace('ticket_create_', '');
    const user = interaction.user;
    const config = await getConfig(guildId);
    if (!config) return interaction.reply({ content: '⚠️ Ticket system not configured.', flags: 64 });

    const { rows: existing } = await pool.query(`SELECT * FROM tickets WHERE guild_id=$1 AND user_id=$2 AND status='open'`, [guildId, user.id]);
    if (existing.length > 0) return interaction.reply({ content: `⚠️ You already have an open ticket: <#${existing[0].channel_id}>`, flags: 64 });

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
      channelOptions.permissionOverwrites.push({ id: config.staff_role_id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages', 'AttachFiles'] });
    }
    if (config.category_id) channelOptions.parent = config.category_id;

    let ticketChannel;
    try { ticketChannel = await guild.channels.create(channelOptions); }
    catch (err) { return interaction.reply({ content: '❌ Failed to create ticket channel. Check my permissions.', flags: 64 }); }

    await pool.query(`INSERT INTO tickets (guild_id, channel_id, user_id) VALUES ($1,$2,$3)`, [guildId, ticketChannel.id, user.id]);

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close_btn_${ticketChannel.id}`).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_claim_btn_${ticketChannel.id}`).setLabel('Claim Ticket').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    );

    await ticketChannel.send({
      content: `<@${user.id}>${config.staff_role_id ? ` <@&${config.staff_role_id}>` : ''}`,
      embeds: [new EmbedBuilder()
        .setTitle('🎫 Support Ticket')
        .setColor(0x5865f2)
        .setDescription(`Hey <@${user.id}>, welcome to your ticket!\n\nDescribe your issue and a staff member will assist you shortly.`)
        .addFields(
          { name: '👤 Opened by', value: `<@${user.id}>`, inline: true },
          { name: '📅 Opened at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '🛡️ Status', value: '🔴 Unclaimed', inline: true },
        )
        .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }))
        .setFooter({ text: 'A mod will claim this ticket shortly' })],
      components: [closeRow]
    });

    return interaction.reply({ content: `✅ Your ticket: <#${ticketChannel.id}>`, flags: 64 });
  }
};
