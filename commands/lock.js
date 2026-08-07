const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock a channel')
    .setDescriptionLocalizations({
      'nl': 'Vergrendel of ontgrendel een kanaal',
      'fr': 'Verrouiller ou déverrouiller un canal',
      'hi': 'चैनल को लॉक या अनलॉक करें'
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Lock a channel so nobody can send messages')
        .setDescriptionLocalizations({
          'nl': 'Vergrendel een kanaal zodat niemand berichten kan sturen',
          'fr': 'Verrouiller un canal pour que personne ne puisse envoyer de messages',
          'hi': 'एक चैनल लॉक करें ताकि कोई भी संदेश न भेज सके'
        })
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (leave empty for current channel)').setDescriptionLocalizations({ 'nl': 'Kanaal om te vergrendelen (leeg laten voor huidige kanaal)', 'fr': 'Canal à verrouiller (laisser vide pour le canal actuel)', 'hi': 'लॉक करने के लिए चैनल (वर्तमान चैनल के लिए खाली छोड़ें)' }).setRequired(false))
    )

    .addSubcommand(sub =>
      sub.setName('open')
        .setDescription('Unlock a channel so everyone can send messages again')
        .setDescriptionLocalizations({
          'nl': 'Ontgrendel een kanaal zodat iedereen weer berichten kan sturen',
          'fr': 'Déverrouiller un canal pour que tout le monde puisse à nouveau envoyer des messages',
          'hi': 'चैनल अनलॉक करें ताकि हर कोई फिर से संदेश भेज सके'
        })
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (leave empty for current channel)').setDescriptionLocalizations({ 'nl': 'Kanaal om te ontgrendelen (leeg laten voor huidige kanaal)', 'fr': 'Canal à déverrouiller (laisser vide pour le canal actuel)', 'hi': 'अनलॉक करने के लिए चैनल (वर्तमान चैनल के लिए खाली छोड़ें)' }).setRequired(false))
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: '⚠️ This command can only be used inside a server.', flags: 64 });

    const lang = await getGuildLang(guild.id);
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getChannel('channel') || interaction.channel;
    const everyoneRole = guild.roles.everyone;

    if (sub === 'channel') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(t(lang, 'lock_title'))
            .setColor(0xff4444)
            .setDescription(t(lang, 'lock_desc', { channel: target.id }))
            .setFooter({ text: t(lang, 'locked_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to lock channel:', err.message);
        return interaction.reply({ content: t(lang, 'lock_error'), flags: 64 });
      }
    }

    if (sub === 'open') {
      try {
        await target.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        });

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(t(lang, 'unlock_title'))
            .setColor(0x00cc66)
            .setDescription(t(lang, 'unlock_desc', { channel: target.id }))
            .setFooter({ text: t(lang, 'unlocked_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to unlock channel:', err.message);
        return interaction.reply({ content: t(lang, 'unlock_error'), flags: 64 });
      }
    }
  }
};