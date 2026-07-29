const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a full overview of all Oscar Bot commands.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🐾 Oscar Bot — Full Command Reference')
      .setColor(0x5865F2)
      .setDescription('Here is a complete list of all available commands organized by category:')
      .addFields(
        {
          name: '⚠️ Moderation & Member Management',
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
          name: '🎫 Ticket System',
          value:
            '`/ticket setup` — Configures the ticket system & staff roles.\n' +
            '`/ticket panel` — Sends an interactive "Open a Ticket" button panel.\n' +
            '`/ticket claim` | `/unclaim` — Claim or release active tickets.\n' +
            '`/ticket close` — Closes a ticket and triggers rating prompts.\n' +
            '`/ticket add` | `/remove` — Manage user access in tickets.\n' +
            '`/ticket ratings` | `/ratingban` | `/ratingunban` — Manage staff ratings.'
        },
        {
          name: '📊 Staff Activity & Tasks',
          value:
            '`/staffstats` — Shows staff activity metrics (tickets, warns, bans, etc.).\n' +
            '`/task` — Staff tool to assign and organize internal duties.'
        },
        {
          name: '🛡️ Verification & Welcome',
          value:
            '`/setup-verify` — Posts an interactive verification panel.\n' +
            '`/welcome` — Configures custom welcome messages and channel settings.'
        },
        {
          name: '🛠️ Utility & Server Tools',
          value:
            '`/poll` — Creates a quick poll for members to vote on.\n' +
            '`/roleinfo` — Displays detailed info and permissions for a role.\n' +
            '`/ping` — Checks the bot\'s current API latency and status.\n' +
            '`/afk` — Sets AFK status and auto-replies when mentioned.'
        },
        {
          name: '🚀 Boosts, Reaction Roles & Giveaways',
          value:
            '`/reactionrole add` | `remove` | `list` — Emoji-based self-roles.\n' +
            '`/boost setup` | `/boost config` — Configure booster rewards.\n' +
            '`/giveaway start` | `end` | `reroll` | `bonus` | `bonuslist` — Run giveaways.'
        },
        {
          name: '🎮 Games',
          value:
            '`/hangrygames new` | `role` | `cancel` — Start or cancel a Battle Royale simulation.'
        }
      )
      .setFooter({ text: 'Oscar Bot by DevOJello · built with discord.js v14' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
