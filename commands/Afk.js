const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

// In-memory AFK store: userId -> { reason, since, guildId }
const afkUsers = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status / Stel je AFK status in')
    .setDescriptionLocalizations({
      'nl': 'Stel je AFK-status in',
      'en-US': 'Set your AFK status',
      'en-GB': 'Set your AFK status'
    })
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for being AFK / Reden voor AFK')
        .setRequired(false)
    ),

  async execute(interaction) {
    // 1. Haal de taal op van de server
    const lang = await getGuildLang(interaction.guildId);

    const rawReason = interaction.options.getString('reason');
    // Gebruik de opgegeven reden of de standaard 'AFK' vertaling
    const reason = rawReason || t(lang, 'afk_default_reason');
    const member = interaction.member;

    // Save AFK state
    afkUsers.set(interaction.user.id, {
      reason,
      since: Date.now(),
      guildId: interaction.guild.id,
    });

    // Clean current name just in case it already has [AFK]
    const currentDisplayName = member.displayName.replace(/^\[AFK\]\s*/i, '');

    // Set new nickname if manageable
    if (member.manageable) {
      try {
        const newNick = `[AFK] ${currentDisplayName}`.slice(0, 32);
        await member.setNickname(newNick);
      } catch (err) {
        console.log(`Failed to set AFK nickname for ${member.user.tag}`);
      }
    }

    // 2. Reply met de vertaalde embed tekst
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffa500)
          .setDescription(t(lang, 'afk_set_success', { user: member.user.username, reason }))
      ]
    });
  },

  afkUsers,
};