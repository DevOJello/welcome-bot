const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLang } = require('../utils/getLang');
const { t } = require('../locales');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages from a channel')
    .setDescriptionLocalizations({
      'nl': 'Verwijder een aantal berichten uit een kanaal',
      'fr': 'Supprimer un nombre de messages d\'un canal',
      'hi': 'एक चैनल से कई संदेश हटाएं'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setDescriptionLocalizations({
          'nl': 'Aantal te verwijderen berichten (1-100)',
          'fr': 'Nombre de messages à supprimer (1-100)',
          'hi': 'हटाए जाने वाले संदेशों की संख्या (1-100)'
        })
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to clear (leave empty for current channel)')
        .setDescriptionLocalizations({
          'nl': 'Kanaal om te wissen (laat leeg voor huidige kanaal)',
          'fr': 'Canal à effacer (laisser vide pour le canal actuel)',
          'hi': 'साफ़ करने के लिए चैनल (वर्तमान चैनल के लिए खाली छोड़ दें)'
        })
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const lang = await getGuildLang(guild.id);
    const amount = interaction.options.getInteger('amount');
    const target = interaction.options.getChannel('channel') || interaction.channel;

    await interaction.deferReply({ flags: 64 });

    try {
      const deleted = await target.bulkDelete(amount, true);

      // Track stat
      try {
        const { incrementStat } = require('./staffstats');
        await incrementStat(interaction.user.id, interaction.guild.id, 'messages_cleared');
      } catch {}

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle(t(lang, 'clear_title'))
          .setColor(0x5865f2)
          .setDescription(t(lang, 'clear_description', { count: deleted.size, channel: target.id }) + (deleted.size < amount ? `\n\n${t(lang, 'clear_old_messages_warning')}` : ''))
          .setFooter({ text: t(lang, 'clear_footer', { user: interaction.user.username }) })
          .setTimestamp()]
      });
    } catch (err) {
      console.error('Failed to clear messages:', err.message);
      return interaction.editReply({ content: t(lang, 'clear_error'), flags: 64 });
    }
  }
};