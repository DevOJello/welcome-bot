const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_config (
      guild_id TEXT PRIMARY KEY,
      category_id TEXT,
      transcript_channel_id TEXT,
      staff_role_id TEXT,
      ticket_types JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE ticket_config ADD COLUMN IF NOT EXISTS ticket_types JSONB DEFAULT '[]'`);

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
      rating_reason TEXT,
      rated_by TEXT,
      ticket_type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS claimed_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating INTEGER`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating_reason TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rated_by TEXT`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rating_blacklist (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      banned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE staff_stats ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0`).catch(() => {});
}
initDB().catch(err => console.error('❌ Ticket DB init error:', err));

async function getConfig(guildId) {
  const { rows } = await pool.query(`SELECT * FROM ticket_config WHERE guild_id = $1`, [guildId]);
  return rows[0] || null;
}

async function generateTranscript(channel, lang) {
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
  const header = `${t(lang, 'ticket_transcript_header', { name: channel.name, count: sorted.length })}\n${'─'.repeat(50)}\n\n`;
  const lines = sorted.map(m => {
    const time = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const parts = [];
    if (m.content) parts.push(m.content);
    if (m.attachments.size > 0) parts.push(`[${m.attachments.size} attachment(s): ${[...m.attachments.values()].map(a => a.url).join(' | ')}]`);
    if (m.embeds.length > 0) parts.push(`[${m.embeds.length} embed(s): ${m.embeds.map(e => e.title || e.description?.slice(0, 50) || 'embed').join(' | ')}]`);
    return `[${time}] ${m.author.tag}: ${parts.join(' ') || '[empty]'}`;
  }).join('\n');
  return header + (lines || t(lang, 'ticket_no_messages'));
}

async function saveTranscriptAndDelete(channel, guild, ticket, closedById, client) {
  const lang = await getGuildLang(guild.id);
  const config = await getConfig(guild.id);
  if (config?.transcript_channel_id) {
    try {
      const transcript = await generateTranscript(channel, lang);
      const transcriptChannel = guild.channels.cache.get(config.transcript_channel_id);
      if (transcriptChannel) {
        const buffer = Buffer.from(transcript, 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: `ticket-${ticket.id}-${channel.name}.txt` });
        let closedByUser;
        try { closedByUser = await client.users.fetch(closedById || ticket.closed_by); } catch {}
        let claimedByUser;
        if (ticket.claimed_by) { try { claimedByUser = await client.users.fetch(ticket.claimed_by); } catch {} }

        const ratingField = ticket.rating
          ? `${'⭐'.repeat(ticket.rating)} (${ticket.rating}/5)${ticket.rating_reason ? `\n> ${ticket.rating_reason}` : ''}`
          : t(lang, 'ticket_no_rating_yet');

        await transcriptChannel.send({
          embeds: [new EmbedBuilder()
            .setTitle(`📋 ${t(lang, 'ticket_transcript_title')}`)
            .setColor(0x5865f2)
            .addFields(
              { name: `🎫 ${t(lang, 'ticket_label')}`, value: `#${channel.name}`, inline: true },
              { name: `📂 ${t(lang, 'ticket_category')}`, value: ticket.ticket_type || 'General', inline: true },
              { name: `👤 ${t(lang, 'ticket_opened_by')}`, value: `<@${ticket.user_id}>`, inline: true },
              { name: `🔒 ${t(lang, 'ticket_closed_by')}`, value: closedByUser ? `<@${closedByUser.id}>` : t(lang, 'ticket_unknown'), inline: true },
              { name: `🛡️ ${t(lang, 'ticket_claimed_by')}`, value: claimedByUser ? `<@${claimedByUser.id}>` : `*${t(lang, 'ticket_unclaimed')}*`, inline: true },
              { name: `⭐ ${t(lang, 'ticket_rating')}`, value: ratingField, inline: false },
              { name: `📅 ${t(lang, 'ticket_opened_on')}`, value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`, inline: true },
            )
            .setTimestamp()],
          files: [attachment]
        });
      }
    } catch (err) {
      console.error('Failed to save transcript:', err.message);
    }
  }

  if (ticket.claimed_by && ticket.user_id) {
    try {
      const ticketUser = await client.users.fetch(ticket.user_id);
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
            .setTitle(`⭐ ${t(lang, 'ticket_rate_title')}`)
            .setColor(0xffd700)
            .setDescription(t(lang, 'ticket_rate_desc', { guild: guild.name, claimed_by: ticket.claimed_by }))
            .setFooter({ text: t(lang, 'ticket_rate_footer') })],
          components: [ratingRow]
        });
        await pool.query(`UPDATE tickets SET status = 'awaiting_rating', closed_by = $1 WHERE id = $2`, [closedById, ticket.id]);
        setTimeout(async () => { try { await channel.delete(); } catch {} }, 5000);
        return;
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
        .addChannelOption(opt => opt.setName('category').setDescription('Discord category to create ticket channels in').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('types')
        .setDescription('Set up to 5 ticket categories shown as buttons on the panel')
        .addStringOption(opt => opt.setName('type1').setDescription('e.g. 🎫 General Support').setRequired(true))
        .addStringOption(opt => opt.setName('type2').setDescription('e.g. 🛒 Shop Support').setRequired(false))
        .addStringOption(opt => opt.setName('type3').setDescription('Category 3').setRequired(false))
        .addStringOption(opt => opt.setName('type4').setDescription('Category 4').setRequired(false))
        .addStringOption(opt => opt.setName('type5').setDescription('Category 5').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Send the ticket panel with category buttons to a channel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send the panel in').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Custom message on the panel').setRequired(false))
    )
    .addSubcommand(sub => sub.setName('close').setDescription('Close the current ticket'))
    .addSubcommand(sub => sub.setName('claim').setDescription('Claim this ticket as your responsibility'))
    .addSubcommand(sub => sub.setName('unclaim').setDescription('Unclaim this ticket'))
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
    const lang = await getGuildLang(interaction.guildId);

    if (!guild) return interaction.reply({ content: t(lang, 'guild_only_command'), flags: 64 });
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
        embeds: [new EmbedBuilder().setTitle(`✅ ${t(lang, 'ticket_setup_title')}`).setColor(0x00cc66)
          .addFields(
            { name: `👥 ${t(lang, 'ticket_staff_role')}`, value: `<@&${staffRole.id}>`, inline: true },
            { name: `📋 ${t(lang, 'ticket_transcript_chan')}`, value: `<#${transcriptChannel.id}>`, inline: true },
            { name: `📁 ${t(lang, 'ticket_category')}`, value: category ? category.name : t(lang, 'ticket_default'), inline: true },
          )
          .setFooter({ text: t(lang, 'ticket_setup_footer') })]
      });
    }

    // ── TYPES ────────────────────────────────────────────────────────────────
    if (sub === 'types') {
      const types = ['type1', 'type2', 'type3', 'type4', 'type5']
        .map(key => interaction.options.getString(key))
        .filter(Boolean);

      const config = await getConfig(guild.id);
      if (!config) return interaction.reply({ content: t(lang, 'ticket_not_setup'), flags: 64 });

      await pool.query(`UPDATE ticket_config SET ticket_types = $1, updated_at = NOW() WHERE guild_id = $2`, [JSON.stringify(types), guild.id]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`✅ ${t(lang, 'ticket_types_title')}`)
          .setColor(0x00cc66)
          .setDescription(types.map((t, i) => `${i + 1}. ${t}`).join('\n'))
          .setFooter({ text: t(lang, 'ticket_types_footer') })]
      });
    }

    // ── PANEL ────────────────────────────────────────────────────────────────
    if (sub === 'panel') {
      const config = await getConfig(guild.id);
      if (!config) return interaction.reply({ content: t(lang, 'ticket_not_setup'), flags: 64 });
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || t(lang, 'ticket_panel_desc');

      const types = (config.ticket_types && config.ticket_types.length > 0) ? config.ticket_types : [t(lang, 'ticket_gen_support')];
      const row = new ActionRowBuilder().addComponents(
        ...types.slice(0, 5).map((type, i) =>
          new ButtonBuilder()
            .setCustomId(`ticket_create_${guild.id}_${i}`)
            .setLabel(type.slice(0, 80))
            .setStyle(ButtonStyle.Primary)
        )
      );

      await channel.send({
        embeds: [new EmbedBuilder().setTitle(`🎫 ${t(lang, 'ticket_panel_title')}`).setColor(0x5865f2).setDescription(message)
          .addFields({ name: `📂 ${t(lang, 'ticket_categories')}`, value: types.map(ty => `• ${ty}`).join('\n') })
          .setFooter({ text: t(lang, 'ticket_panel_footer') })],
        components: [row]
      });
      return interaction.reply({ content: t(lang, 'ticket_panel_success', { channel: channel.id }), flags: 64 });
    }

    // ── CLAIM ────────────────────────────────────────────────────────────────
    if (sub === 'claim') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_active'), flags: 64 });
      const ticket = rows[0];
      if (ticket.claimed_by) return interaction.reply({ content: t(lang, 'ticket_already_claimed', { user: ticket.claimed_by }), flags: 64 });
      await pool.query(`UPDATE tickets SET claimed_by=$1 WHERE id=$2`, [interaction.user.id, ticket.id]);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00cc66)
          .setDescription(t(lang, 'ticket_claimed_msg', { user: interaction.user.id }))]
      });
    }

    // ── UNCLAIM ──────────────────────────────────────────────────────────────
    if (sub === 'unclaim') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_active'), flags: 64 });
      await pool.query(`UPDATE tickets SET claimed_by=NULL WHERE id=$1`, [rows[0].id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff9900).setDescription(`🔓 ${t(lang, 'ticket_unclaimed_msg')}`)] });
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_active'), flags: 64 });
      const ticket = rows[0];
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false }); } catch {}
      await pool.query(`UPDATE tickets SET status='closed', closed_at=NOW(), closed_by=$1 WHERE id=$2`, [interaction.user.id, ticket.id]);
      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, guild.id, 'tickets_closed');
      } catch {}
      const deleteTime = Math.floor(Date.now() / 1000) + 86400;
      const reopenRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_reopen_${interaction.channelId}`).setLabel(t(lang, 'ticket_btn_reopen')).setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_delete_${interaction.channelId}`).setLabel(t(lang, 'ticket_btn_delete')).setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle(`🔒 ${t(lang, 'ticket_closed_title')}`).setColor(0xff4444)
          .setDescription(
            `${t(lang, 'ticket_closed_by_desc', { user: interaction.user.id })}\n` +
            (ticket.claimed_by ? `🛡️ ${t(lang, 'ticket_handled_by', { user: ticket.claimed_by })}\n` : '') +
            `\n${t(lang, 'ticket_closed_info', { time: deleteTime })}`
          )
          .setFooter({ text: t(lang, 'ticket_closed_footer') })],
        components: [reopenRow]
      });
    }

    // ── ADD / REMOVE ─────────────────────────────────────────────────────────
    if (sub === 'add') {
      const { rows } = await pool.query(`SELECT 1 FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_active'), flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00cc66).setDescription(`✅ ${t(lang, 'ticket_user_added', { user: user.id })}`)] });
    }
    if (sub === 'remove') {
      const { rows } = await pool.query(`SELECT 1 FROM tickets WHERE channel_id=$1 AND status='open'`, [interaction.channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_active'), flags: 64 });
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`✅ ${t(lang, 'ticket_user_removed', { user: user.id })}`)] });
    }

    // ── RATING BAN / UNBAN ────────────────────────────────────────────────────
    if (sub === 'ratingban') {
      const user = interaction.options.getUser('user');
      await pool.query(`INSERT INTO rating_blacklist (user_id, guild_id, banned_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [user.id, guild.id, interaction.user.id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`🚫 ${t(lang, 'ticket_rating_banned', { user: user.id })}`)] });
    }
    if (sub === 'ratingunban') {
      const user = interaction.options.getUser('user');
      await pool.query(`DELETE FROM rating_blacklist WHERE user_id=$1 AND guild_id=$2`, [user.id, guild.id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00cc66).setDescription(`✅ ${t(lang, 'ticket_rating_unbanned', { user: user.id })}`)] });
    }

    // ── RATINGS ──────────────────────────────────────────────────────────────
    if (sub === 'ratings') {
      const staff = interaction.options.getUser('staff');
      const { rows: statsRows } = await pool.query(`SELECT total_ratings, rating_sum FROM staff_stats WHERE user_id=$1 AND guild_id=$2`, [staff.id, guild.id]);
      const stats = statsRows[0] || { total_ratings: 0, rating_sum: 0 };
      const avg = stats.total_ratings > 0 ? (stats.rating_sum / stats.total_ratings).toFixed(2) : 'N/A';
      const stars = stats.total_ratings > 0 ? '⭐'.repeat(Math.round(stats.rating_sum / stats.total_ratings)) : t(lang, 'ticket_no_ratings_yet');

      const { rows: lowRatings } = await pool.query(`
        SELECT rating, rating_reason, created_at FROM tickets
        WHERE claimed_by=$1 AND guild_id=$2 AND rating IS NOT NULL AND rating <= 2
        ORDER BY created_at DESC LIMIT 3
      `, [staff.id, guild.id]);

      const embed = new EmbedBuilder()
        .setTitle(`⭐ ${t(lang, 'ticket_rating_stats_title', { user: staff.username })}`)
        .setColor(0xffd700)
        .setThumbnail(staff.displayAvatarURL({ extension: 'png' }))
        .addFields(
          { name: `⭐ ${t(lang, 'ticket_avg_rating')}`, value: `${avg}/5 ${stars}`, inline: true },
          { name: `📊 ${t(lang, 'ticket_total_ratings')}`, value: `${stats.total_ratings}`, inline: true },
        )
        .setTimestamp();

      if (lowRatings.length > 0) {
        embed.addFields({
          name: `⚠️ ${t(lang, 'ticket_recent_low')}`,
          value: lowRatings.map(r => `${'⭐'.repeat(r.rating)} — ${r.rating_reason || `*${t(lang, 'ticket_no_reason')}*`}`).join('\n\n')
        });
      }

      return interaction.reply({ embeds: [embed] });
    }
  },

  async handleButton(interaction, client) {
    const guild = interaction.guild;
    const lang = await getGuildLang(interaction.guildId);
    schedulerClient = client;

    // ── CLAIM BUTTON ──────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_claim_btn_')) {
      const channelId = interaction.customId.replace('ticket_claim_btn_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_no_longer_active'), flags: 64 });
      const ticket = rows[0];
      if (ticket.claimed_by) return interaction.reply({ content: t(lang, 'ticket_already_claimed', { user: ticket.claimed_by }), flags: 64 });

      await pool.query(`UPDATE tickets SET claimed_by=$1 WHERE id=$2`, [interaction.user.id, ticket.id]);

      const updatedCloseRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_btn_${channelId}`).setLabel(t(lang, 'ticket_btn_close')).setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_claim_btn_${channelId}`).setLabel(t(lang, 'ticket_btn_claimed')).setEmoji('🛡️').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      try { await interaction.message.edit({ components: [updatedCloseRow] }); } catch {}

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00cc66)
          .setDescription(`🛡️ ${t(lang, 'ticket_claimed_msg', { user: interaction.user.id })}`)]
      });
    }

    // ── REOPEN ───────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_reopen_')) {
      const channelId = interaction.customId.replace('ticket_reopen_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='closed'`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_cannot_reopen'), flags: 64 });
      const ticket = rows[0];
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); } catch {}
      await pool.query(`UPDATE tickets SET status='open', closed_at=NULL WHERE channel_id=$1`, [channelId]);
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_btn_${channelId}`).setLabel(t(lang, 'ticket_btn_close')).setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x00cc66)
          .setTitle(`🔓 ${t(lang, 'ticket_reopened_title')}`)
          .setDescription(t(lang, 'ticket_reopened_desc', { staff: interaction.user.id, opener: ticket.user_id }))],
        components: [closeRow]
      });
    }

    // ── DELETE NOW ────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_delete_')) {
      const channelId = interaction.customId.replace('ticket_delete_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_found'), flags: 64 });
      await interaction.update({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`🗑️ ${t(lang, 'ticket_saving_del')}`)], components: [] });
      await saveTranscriptAndDelete(interaction.channel, guild, rows[0], interaction.user.id, client);
      return;
    }

    // ── CLOSE BUTTON ──────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_close_btn_')) {
      const channelId = interaction.customId.replace('ticket_close_btn_', '');
      const { rows } = await pool.query(`SELECT * FROM tickets WHERE channel_id=$1 AND status='open'`, [channelId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_already_closed'), flags: 64 });
      const ticket = rows[0];
      try { await interaction.channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false }); } catch {}
      await pool.query(`UPDATE tickets SET status='closed', closed_at=NOW(), closed_by=$1 WHERE channel_id=$2`, [interaction.user.id, channelId]);
      try { const { incrementStat } = require('./staffstats'); await incrementStat(interaction.user.id, guild.id, 'tickets_closed'); } catch {}
      const deleteTime = Math.floor(Date.now() / 1000) + 86400;
      const reopenRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_reopen_${channelId}`).setLabel(t(lang, 'ticket_btn_reopen')).setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_delete_${channelId}`).setLabel(t(lang, 'ticket_btn_delete')).setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle(`🔒 ${t(lang, 'ticket_closed_title')}`).setColor(0xff4444)
          .setDescription(
            `${t(lang, 'ticket_closed_by_desc', { user: interaction.user.id })}\n` +
            (ticket.claimed_by ? `🛡️ ${t(lang, 'ticket_handled_by', { user: ticket.claimed_by })}\n` : '') +
            `\n${t(lang, 'ticket_closed_info', { time: deleteTime })}`
          )
          .setFooter({ text: t(lang, 'ticket_closed_footer') })],
        components: [reopenRow]
      });
    }

    // ── STAR RATING BUTTON ────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_rate_')) {
      const parts = interaction.customId.split('_');
      const ticketId = parseInt(parts[2]);
      const rating = parseInt(parts[3]);

      const { rows } = await pool.query(`SELECT * FROM tickets WHERE id=$1`, [ticketId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_found'), flags: 64 });
      const ticket = rows[0];

      if (ticket.rating) return interaction.reply({ content: t(lang, 'ticket_already_rated'), flags: 64 });
      if (interaction.user.id !== ticket.user_id) return interaction.reply({ content: t(lang, 'ticket_only_opener_rate'), flags: 64 });

      const { rows: bl } = await pool.query(`SELECT 1 FROM rating_blacklist WHERE user_id=$1 AND guild_id=$2`, [interaction.user.id, ticket.guild_id]);
      if (bl.length > 0) return interaction.reply({ content: t(lang, 'ticket_rating_forbidden'), flags: 64 });

      if (rating <= 2) {
        const modal = new ModalBuilder()
          .setCustomId(`ticket_rate_reason_${ticketId}_${rating}`)
          .setTitle(t(lang, 'ticket_rate_modal_title', { rating }));

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(t(lang, 'ticket_rate_modal_label'))
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(t(lang, 'ticket_rate_modal_ph'))
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        return interaction.showModal(modal);
      }

      await pool.query(`UPDATE tickets SET rating=$1, rated_by=$2, status='deleted' WHERE id=$3`, [rating, interaction.user.id, ticketId]);

      if (ticket.claimed_by) {
        try {
          const { addRating } = require('./staffstats');
          await addRating(ticket.claimed_by, ticket.guild_id, rating);
        } catch (err) {
          console.error('Failed to record rating in staff_stats:', err.message);
        }
      }

      const stars = '⭐'.repeat(rating);
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setTitle(`⭐ ${t(lang, 'ticket_rate_thanks_title')}`)
          .setColor(0x2ecc71)
          .setDescription(t(lang, 'ticket_rate_thanks_desc', { stars, rating }))],
        components: []
      });
      return;
    }

    // ── CREATE BUTTON ─────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_create_')) {
      const parts = interaction.customId.replace('ticket_create_', '').split('_');
      const guildId = parts[0];
      const typeIndex = parts[1] !== undefined ? parseInt(parts[1]) : 0;
      const user = interaction.user;
      const config = await getConfig(guildId);
      if (!config) return interaction.reply({ content: t(lang, 'ticket_not_setup'), flags: 64 });

      const types = (config.ticket_types && config.ticket_types.length > 0) ? config.ticket_types : [t(lang, 'ticket_gen_support')];
      const ticketType = types[typeIndex] || types[0];

      const { rows: existing } = await pool.query(`SELECT * FROM tickets WHERE guild_id=$1 AND user_id=$2 AND status='open'`, [guildId, user.id]);
      if (existing.length > 0) return interaction.reply({ content: t(lang, 'ticket_already_open', { channel: existing[0].channel_id }), flags: 64 });

      const cleanType = ticketType.replace(/[^\w\s]/gi, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 15) || 'ticket';
      const cleanUser = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);

      const channelOptions = {
        name: `🎫・${cleanUser}-${cleanType}`,
        type: ChannelType.GuildText,
        topic: `Ticket opened by ${user.tag} | Category: ${ticketType}`,
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
      catch (err) { return interaction.reply({ content: t(lang, 'ticket_create_failed'), flags: 64 }); }

      await pool.query(`INSERT INTO tickets (guild_id, channel_id, user_id, ticket_type) VALUES ($1,$2,$3,$4)`, [guildId, ticketChannel.id, user.id, ticketType]);

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_btn_${ticketChannel.id}`).setLabel(t(lang, 'ticket_btn_close')).setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_claim_btn_${ticketChannel.id}`).setLabel(t(lang, 'ticket_btn_claim')).setEmoji('🛡️').setStyle(ButtonStyle.Primary),
      );

      await ticketChannel.send({
        content: `<@${user.id}>${config.staff_role_id ? ` <@&${config.staff_role_id}>` : ''}`,
        embeds: [new EmbedBuilder()
          .setTitle(`🎫 ${t(lang, 'ticket_support_title')}`)
          .setColor(0x5865f2)
          .setDescription(t(lang, 'ticket_welcome', { user: user.id }))
          .addFields(
            { name: `👤 ${t(lang, 'ticket_opened_by')}`, value: `<@${user.id}>`, inline: true },
            { name: `📂 ${t(lang, 'ticket_category')}`, value: ticketType, inline: true },
            { name: `🛡️ ${t(lang, 'ticket_status')}`, value: `🔴 ${t(lang, 'ticket_unclaimed')}`, inline: true },
          )
          .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }))
          .setFooter({ text: t(lang, 'ticket_mod_claim') })],
        components: [closeRow]
      });

      return interaction.reply({ content: t(lang, 'ticket_created_success', { channel: ticketChannel.id }), flags: 64 });
    }

    // ── RATING REASON MODAL SUBMIT ────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_rate_reason_')) {
      const parts = interaction.customId.split('_');
      const ticketId = parseInt(parts[3]);
      const rating = parseInt(parts[4]);
      const reason = interaction.fields.getTextInputValue('reason');

      const { rows } = await pool.query(`SELECT * FROM tickets WHERE id=$1`, [ticketId]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'ticket_not_found'), flags: 64 });
      const ticket = rows[0];

      await pool.query(`UPDATE tickets SET rating=$1, rating_reason=$2, rated_by=$3, status='deleted' WHERE id=$4`, [rating, reason, interaction.user.id, ticketId]);

      if (ticket.claimed_by) {
        try {
          const { addRating } = require('./staffstats');
          await addRating(ticket.claimed_by, ticket.guild_id, rating);
        } catch (err) {
          console.error('Failed to record rating in staff_stats:', err.message);
        }
      }

      const stars = '⭐'.repeat(rating);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`⭐ ${t(lang, 'ticket_rate_thanks_title')}`)
          .setColor(0xe74c3c)
          .setDescription(t(lang, 'ticket_rate_reason_logged', { stars, rating }))]
      });
    }
  }
};