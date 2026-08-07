const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a full overview of all Oscar Bot commands.')
    .setDescriptionLocalizations({
      'nl': 'Toont een volledig overzicht van alle Oscar Bot-commando\'s.',
      'fr': 'Affiche un aperçu complet de toutes les commandes d\'Oscar Bot.',
      'hi': 'Oscar Bot के सभी कमांड का पूर्ण overview प्रदर्शित करता है।'
    }),

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
            '`/ban` — ' + t(lang, 'help_ban_desc') + '\n' +
            '`/unban` — ' + t(lang, 'help_unban_desc') + '\n' +
            '`/tempban` — ' + t(lang, 'help_tempban_desc') + '\n' +
            '`/softban` — ' + t(lang, 'help_softban_desc') + '\n' +
            '`/kick` — ' + t(lang, 'help_kick_desc') + '\n' +
            '`/dossier` — ' + t(lang, 'help_dossier_desc') + '\n' +
            '`/warn add` | `/remove` | `/list` — ' + t(lang, 'help_warn_desc') + '\n' +
            '`/lock channel` | `/lock open` — ' + t(lang, 'help_lock_desc') + '\n' +
            '`/clear` — ' + t(lang, 'help_clear_desc') + '\n' +
            '`/role add` | `/role remove` — ' + t(lang, 'help_role_desc')
        },
        {
          name: t(lang, 'help_cat_tickets'),
          value:
            '`/ticket setup` — ' + t(lang, 'help_ticket_desc') + '\n' +
            '`/staffstats` — ' + t(lang, 'help_staffstats_desc') + '\n' +
            '`/task` — ' + t(lang, 'help_task_desc')
        },
        {
          name: t(lang, 'help_cat_verify'),
          value:
            '`/setup-verify` — ' + t(lang, 'help_verify_desc') + '\n' +
            '`/welcome` — ' + t(lang, 'help_welcome_desc')
        },
        {
          name: t(lang, 'help_cat_tools'),
          value:
            '`/poll` — ' + t(lang, 'help_poll_desc', { default: 'Creates a quick poll for members to vote on.' }) + '\n' +
            '`/roleinfo` — ' + t(lang, 'help_roleinfo_desc', { default: 'Displays detailed info and permissions for a role.' }) + '\n' +
            '`/ping` — ' + t(lang, 'help_ping_desc', { default: 'Checks the bot\'s current API latency and status.' }) + '\n' +
            '`/afk` — ' + t(lang, 'help_afk_desc', { default: 'Sets AFK status and auto-replies when mentioned.' }) + '\n' +
            '`/language` — ' + t(lang, 'help_language_desc', { default: 'Change bot language for the server.' }) + '\n' +
            '`/logtoggle` — ' + t(lang, 'help_logtoggle_desc') + '\n' +
            '`/setlog` — ' + t(lang, 'help_setlog_desc')
        },
        {
          name: t(lang, 'help_cat_boosts'),
          value:
            '`/reactionrole add` | `remove` | `list` — ' + t(lang, 'help_reactionrole_desc') + '\n' +
            '`/boost setup` | `/boost config` — ' + t(lang, 'help_boost_desc') + '\n' +
            '`/giveaway start` | `end` | `reroll` | `bonus` | `bonuslist` — ' + t(lang, 'help_giveaway_desc')
        },
        {
          name: t(lang, 'help_cat_games'),
          value:
            '`/hangrygames new` | `role` | `cancel` — ' + t(lang, 'help_games_desc')
        }
      )
      .setFooter({ text: 'Oscar Bot by DevOJello · built with discord.js v14' });

    return interaction.reply({ embeds: [embed] });
  }
};