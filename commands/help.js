const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a full overview of all Oscar Bot commands.'),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle(t(lang, 'help_title'))
      .setColor(0x5865F2)
      .setDescription(t(lang, 'help_desc'))
      .addFields(
        {
          name: t(lang, 'help_cat_mod'),
          value:
            '`/ban` — Permanently bans a user from the server.\n' +
            '`/unban` — Unbans a user using their User ID.\n' +
            '`/tempban` — Temporarily bans a user for a set duration.\n' +
            '`/softban` — Bans and immediately unbans a user to purge messages.\n' +
            '`/kick` — Kicks a member out of the server.\n' +
            '`/dossier` — Views full moderation history record for a member.\n' +
            '`/warn add` | `/remove` | `/list` — Manage user warnings.\n' +
            '`/lock channel` | `/lock open` — Lock or unlock text channels.\n' +
            '`/clear` — Bulk-delete messages in a channel.\n' +
            '`/role add` | `/role remove` — Manually assign or strip roles.'
        },
        {
          name: t(lang, 'help_cat_tickets'),
          value:
            '`/ticket setup` — Configures the ticket system & staff roles.\n' +
            '`/staffstats` — Shows staff activity metrics (tickets, warns, bans, etc.).\n' +
            '`/task` — Staff tool to assign and organize internal duties.'
        },
        {
          name: t(lang, 'help_cat_verify'),
          value:
            '`/setup-verify` — Posts an interactive verification panel.\n' +
            '`/welcome` — Configures custom welcome messages and channel settings.'
        },
        {
          name: t(lang, 'help_cat_tools'),
          value:
            '`/poll` — Creates a quick poll for members to vote on.\n' +
            '`/roleinfo` — Displays detailed info and permissions for a role.\n' +
            '`/ping` — Checks the bot\'s current API latency and status.\n' +
            '`/afk` — Sets AFK status and auto-replies when mentioned.\n' +
            '`/language` — Change bot language for the server.\n' +
            '`/logtoggle` — Enable or disable specific log categories.\n' +
            '`/setlog` — Configure the channel where server logs are sent.'
        },
        {
          name: t(lang, 'help_cat_boosts'),
          value:
            '`/reactionrole add` | `remove` | `list` — Emoji-based self-roles.\n' +
            '`/boost setup` | `/boost config` — Configure booster rewards.\n' +
            '`/giveaway start` | `end` | `reroll` | `bonus` | `bonuslist` — Run giveaways.'
        },
        {
          name: t(lang, 'help_cat_games'),
          value:
            '`/hangrygames new` | `role` | `cancel` — Start or cancel a Battle Royale simulation.'
        }
      )
      .setFooter({ text: 'Oscar Bot by DevOJello · built with discord.js v14' });

    return interaction.reply({ embeds: [embed] });
  }
};
