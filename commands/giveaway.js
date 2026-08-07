const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      prize TEXT NOT NULL,
      winners INTEGER DEFAULT 1,
      ends_at TIMESTAMPTZ NOT NULL,
      ended BOOLEAN DEFAULT FALSE,
      host_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id INTEGER REFERENCES giveaways(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      entries INTEGER DEFAULT 1,
      PRIMARY KEY (giveaway_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS giveaway_bonus_roles (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      bonus_entries INTEGER DEFAULT 1,
      UNIQUE(guild_id, role_id)
    )
  `);
}
initDB().catch(err => console.error('❌ Giveaway DB init error:', err));

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

function buildGiveawayEmbed(giveaway, entryCount, ended = false, winners = [], lang = 'en') {
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${giveaway.prize}`)
    .setColor(ended ? 0x888888 : 0xff73fa)
    .addFields(
      { name: `🏆 ${t(lang, 'gw_winners')}`, value: `${giveaway.winners}`, inline: true },
      { name: `👥 ${t(lang, 'gw_entries')}`, value: `${entryCount}`, inline: true },
      { name: `⏰ ${t(lang, 'gw_ends')}`, value: ended ? t(lang, 'gw_ended') : `<t:${Math.floor(new Date(giveaway.ends_at).getTime() / 1000)}:R>`, inline: true },
      { name: `🎟️ ${t(lang, 'gw_hosted_by')}`, value: `<@${giveaway.host_id}>`, inline: true },
    )
    .setTimestamp();

  if (ended && winners.length > 0) {
    embed.addFields({ name: `🏅 ${t(lang, 'gw_winner_s')}`, value: winners.map(id => `<@${id}>`).join(', ') });
    embed.setTitle(`🎊 ${giveaway.prize} — ${t(lang, 'gw_ended')}!`);
  } else if (ended) {
    embed.addFields({ name: `😔 ${t(lang, 'gw_no_winners')}`, value: t(lang, 'gw_not_enough_entries') });
  }

  return embed;
}

async function endGiveaway(giveawayId, client) {
  const { rows: gRows } = await pool.query(`SELECT * FROM giveaways WHERE id = $1`, [giveawayId]);
  const giveaway = gRows[0];
  if (!giveaway || giveaway.ended) return;

  const lang = await getGuildLang(giveaway.guild_id);

  await pool.query(`UPDATE giveaways SET ended = TRUE WHERE id = $1`, [giveawayId]);

  const { rows: entries } = await pool.query(`SELECT * FROM giveaway_entries WHERE giveaway_id = $1`, [giveawayId]);
  const pool2 = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.entries; i++) pool2.push(entry.user_id);
  }

  const winners = [];
  const shuffled = pool2.sort(() => Math.random() - 0.5);
  const seen = new Set();
  for (const userId of shuffled) {
    if (!seen.has(userId)) {
      seen.add(userId);
      winners.push(userId);
      if (winners.length >= giveaway.winners) break;
    }
  }

  try {
    const guild = await client.guilds.fetch(giveaway.guild_id);
    const channel = await guild.channels.fetch(giveaway.channel_id);
    const message = await channel.messages.fetch(giveaway.message_id);

    const embed = buildGiveawayEmbed(giveaway, pool2.length, true, winners, lang);
    await message.edit({ embeds: [embed], components: [] });

    if (winners.length > 0) {
      await channel.send({
        content: `🎊 ${t(lang, 'gw_congrats', { winners: winners.map(id => `<@${id}>`).join(', '), prize: giveaway.prize })}`
      });
    } else {
      await channel.send({ content: `😔 ${t(lang, 'gw_no_valid_entries', { prize: giveaway.prize })}` });
    }
  } catch (err) {
    console.error('Failed to end giveaway:', err.message);
  }
}

// Scheduler: controleert elke 10 seconden
let schedulerClient = null;
setInterval(async () => {
  if (!schedulerClient) return;
  try {
    const { rows } = await pool.query(`
      SELECT id FROM giveaways WHERE ended = FALSE AND ends_at <= NOW() - INTERVAL '5 seconds'
    `);
    for (const row of rows) {
      await endGiveaway(row.id, schedulerClient);
    }
  } catch (err) {
    console.error('Giveaway scheduler error:', err.message);
  }
}, 10000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway system')
    .setDescriptionLocalizations({
      'nl': 'Giveaway-systeem',
      'fr': 'Système de concours',
      'hi': 'giveaway प्रणाली'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a giveaway')
        .setDescriptionLocalizations({
          'nl': 'Start een giveaway',
          'fr': 'Démarrer un concours',
          'hi': 'giveaway शुरू करें'
        })
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setDescriptionLocalizations({ 'nl': 'Wat geef je weg?', 'fr': 'Que donnez-vous en prix ?', 'hi': 'आप क्या दे रहे हैं?' }).setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d').setDescriptionLocalizations({ 'nl': 'Duur bijv. 10m, 2h, 1d', 'fr': 'Durée ex. 10m, 2h, 1d', 'hi': 'अवधि जैसे 10m, 2h, 1d' }).setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)').setDescriptionLocalizations({ 'nl': 'Aantal winnaars (standaard 1)', 'fr': 'Nombre de gagnants (par défaut 1)', 'hi': 'विजेताओं की संख्या (डिफ़ॉल्ट 1)' }).setRequired(false).setMinValue(1).setMaxValue(20))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in (default: current)').setDescriptionLocalizations({ 'nl': 'Kanaal om in te plaatsen (standaard: huidig)', 'fr': 'Canal où publier (par défaut : actuel)', 'hi': 'पोस्ट करने के लिए चैनल (डिफ़ॉल्ट: वर्तमान)' }).setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End a giveaway early')
        .setDescriptionLocalizations({
          'nl': 'Beëindig een giveaway vroegtijdig',
          'fr': 'Terminer un concours plus tôt',
          'hi': 'giveaway जल्दी समाप्त करें'
        })
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the giveaway').setDescriptionLocalizations({ 'nl': 'Bericht-ID van de giveaway', 'fr': 'ID du message du concours', 'hi': 'giveaway की संदेश आईडी' }).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Reroll the winners of an ended giveaway')
        .setDescriptionLocalizations({
          'nl': 'Kies nieuwe winnaars voor een beëindigde giveaway',
          'fr': 'Tirer de nouveaux gagnants pour un concours terminé',
          'hi': 'समाप्त हुए giveaway के विजेताओं को दोबारा चुनें'
        })
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the giveaway').setDescriptionLocalizations({ 'nl': 'Bericht-ID van de giveaway', 'fr': 'ID du message du concours', 'hi': 'giveaway की संदेश आईडी' }).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('bonus')
        .setDescription('Set bonus entries for a role')
        .setDescriptionLocalizations({
          'nl': 'Stel bonusdeelnames in voor een rol',
          'fr': 'Définir des entrées bonus pour un rôle',
          'hi': 'किसी भूमिका के लिए बोनस प्रविष्टियाँ सेट करें'
        })
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give bonus entries').setDescriptionLocalizations({ 'nl': 'Rol om bonusdeelnames aan te geven', 'fr': 'Rôle pour donner des entrées bonus', 'hi': 'बोनस प्रविष्टियाँ देने के लिए भूमिका' }).setRequired(true))
        .addIntegerOption(opt => opt.setName('entries').setDescription('Number of extra entries (0 to remove)').setDescriptionLocalizations({ 'nl': 'Aantal extra deelnames (0 om te verwijderen)', 'fr': 'Nombre d\'entrées supplémentaires (0 pour supprimer)', 'hi': 'अतिरिक्त प्रविष्टियों की संख्या (हटाने के लिए 0)' }).setRequired(true).setMinValue(0).setMaxValue(10))
    )
    .addSubcommand(sub =>
      sub.setName('bonuslist')
        .setDescription('View all bonus entry roles')
        .setDescriptionLocalizations({
          'nl': 'Bekijk alle rollen met bonusdeelnames',
          'fr': 'Afficher tous les rôles avec des entrées bonus',
          'hi': 'सभी बोनस प्रविष्टि भूमिकाएँ देखें'
        })
    ),

  async execute(interaction, client) {
    schedulerClient = client;
    const lang = await getGuildLang(interaction.guildId);
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: t(lang, 'guild_only_command'), flags: 64 });

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winnersCount = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const durationMs = parseDuration(durationStr);
      if (!durationMs) return interaction.reply({ content: t(lang, 'gw_invalid_duration'), flags: 64 });

      const endsAt = new Date(Date.now() + durationMs);

      const { rows } = await pool.query(`
        INSERT INTO giveaways (guild_id, channel_id, prize, winners, ends_at, host_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [guild.id, channel.id, prize, winnersCount, endsAt, interaction.user.id]);

      const giveaway = rows[0];
      const embed = buildGiveawayEmbed(giveaway, 0, false, [], lang);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_enter_${giveaway.id}`)
          .setLabel(t(lang, 'gw_enter_btn'))
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await pool.query(`UPDATE giveaways SET message_id = $1 WHERE id = $2`, [msg.id, giveaway.id]);

      return interaction.reply({ content: t(lang, 'gw_started', { channel: channel.id }), flags: 64 });
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const { rows } = await pool.query(`SELECT * FROM giveaways WHERE message_id = $1 AND guild_id = $2`, [messageId, guild.id]);
      if (!rows[0]) return interaction.reply({ content: t(lang, 'gw_not_found'), flags: 64 });
      if (rows[0].ended) return interaction.reply({ content: t(lang, 'gw_already_ended'), flags: 64 });

      await endGiveaway(rows[0].id, client);
      return interaction.reply({ content: t(lang, 'gw_ended_success'), flags: 64 });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const { rows: gRows } = await pool.query(`SELECT * FROM giveaways WHERE message_id = $1 AND guild_id = $2`, [messageId, guild.id]);
      const giveaway = gRows[0];
      if (!giveaway) return interaction.reply({ content: t(lang, 'gw_not_found'), flags: 64 });
      if (!giveaway.ended) return interaction.reply({ content: t(lang, 'gw_not_ended_yet'), flags: 64 });

      const { rows: entries } = await pool.query(`SELECT * FROM giveaway_entries WHERE giveaway_id = $1`, [giveaway.id]);
      const pool2 = [];
      for (const entry of entries) {
        for (let i = 0; i < entry.entries; i++) pool2.push(entry.user_id);
      }

      const winners = [];
      const seen = new Set();
      for (const userId of pool2.sort(() => Math.random() - 0.5)) {
        if (!seen.has(userId)) { seen.add(userId); winners.push(userId); if (winners.length >= giveaway.winners) break; }
      }

      if (winners.length === 0) return interaction.reply({ content: t(lang, 'gw_no_reroll_entries'), flags: 64 });

      return interaction.reply({
        content: t(lang, 'gw_reroll_success', { winners: winners.map(id => `<@${id}>`).join(', '), prize: giveaway.prize })
      });
    }

    if (sub === 'bonus') {
      const role = interaction.options.getRole('role');
      const entries = interaction.options.getInteger('entries');

      if (entries === 0) {
        await pool.query(`DELETE FROM giveaway_bonus_roles WHERE guild_id = $1 AND role_id = $2`, [guild.id, role.id]);
        return interaction.reply({ content: t(lang, 'gw_bonus_removed', { role: role.id }), flags: 64 });
      }

      await pool.query(`
        INSERT INTO giveaway_bonus_roles (guild_id, role_id, bonus_entries)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, role_id) DO UPDATE SET bonus_entries = $3
      `, [guild.id, role.id, entries]);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff73fa)
          .setDescription(t(lang, 'gw_bonus_added', { role: role.id, entries }))]
      });
    }

    if (sub === 'bonuslist') {
      const { rows } = await pool.query(`SELECT * FROM giveaway_bonus_roles WHERE guild_id = $1`, [guild.id]);
      if (rows.length === 0) return interaction.reply({ content: t(lang, 'gw_bonus_empty'), flags: 64 });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle(t(lang, 'gw_bonus_list_title'))
          .setColor(0xff73fa)
          .setDescription(rows.map(r => `<@&${r.role_id}> — **+${r.bonus_entries}** ${r.bonus_entries === 1 ? 'entry' : 'entries'}`).join('\n'))]
      });
    }
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('giveaway_enter_')) return;
    
    const lang = await getGuildLang(interaction.guildId);
    const giveawayId = parseInt(interaction.customId.split('_')[2]);
    const { rows: gRows } = await pool.query(`SELECT * FROM giveaways WHERE id = $1`, [giveawayId]);
    const giveaway = gRows[0];

    if (!giveaway || giveaway.ended) {
      return interaction.reply({ content: t(lang, 'gw_expired'), flags: 64 });
    }

    const { rows: eRows } = await pool.query(
      `SELECT * FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2`,
      [giveawayId, interaction.user.id]
    );

    if (eRows.length > 0) {
      await pool.query(`DELETE FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2`, [giveawayId, interaction.user.id]);
      const { rows: countRows } = await pool.query(`SELECT SUM(entries) as total FROM giveaway_entries WHERE giveaway_id = $1`, [giveawayId]);
      const totalEntries = countRows[0].total || 0;

      const updatedEmbed = buildGiveawayEmbed(giveaway, totalEntries, false, [], lang);
      await interaction.message.edit({ embeds: [updatedEmbed] });
      return interaction.reply({ content: t(lang, 'gw_left'), flags: 64 });
    }

    let totalEntries = 1;
    const { rows: bonusRoles } = await pool.query(`SELECT * FROM giveaway_bonus_roles WHERE guild_id = $1`, [interaction.guildId]);
    for (const row of bonusRoles) {
      if (interaction.member.roles.cache.has(row.role_id)) {
        totalEntries += row.bonus_entries;
      }
    }

    await pool.query(
      `INSERT INTO giveaway_entries (giveaway_id, user_id, entries) VALUES ($1, $2, $3)`,
      [giveawayId, interaction.user.id, totalEntries]
    );

    const { rows: countRows } = await pool.query(`SELECT SUM(entries) as total FROM giveaway_entries WHERE giveaway_id = $1`, [giveawayId]);
    const totalEntriesCount = countRows[0].total || 0;

    const updatedEmbed = buildGiveawayEmbed(giveaway, totalEntriesCount, false, [], lang);
    await interaction.message.edit({ embeds: [updatedEmbed] });

    return interaction.reply({ content: t(lang, 'gw_entered', { entries: totalEntries }), flags: 64 });
  }
};