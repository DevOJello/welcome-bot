const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Displays detailed information about a specific role')
    .setDescriptionLocalizations({
      'nl': 'Toont gedetailleerde informatie over een specifieke rol',
      'fr': 'Affiche des informations détaillées sur un rôle spécifique',
      'hi': 'किसी विशिष्ट भूमिका के बारे में विस्तृत जानकारी प्रदर्शित करता है'
    })
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role you want to inspect')
        .setDescriptionLocalizations({
          'nl': 'De rol die je wilt bekijken',
          'fr': 'Le rôle que vous souhaitez inspecter',
          'hi': 'वह भूमिका जिसे आप देखना चाहते हैं'
        })
        .setRequired(true)
    ),

  async execute(interaction) {
    const lang = await getGuildLang(interaction.guildId);
    const role = interaction.options.getRole('role');
    const guild = interaction.guild;

    // Fetch all members to accurately count how many users have this role
    await guild.members.fetch().catch(() => {});
    const memberCount = role.members.size;

    // Role properties
    const createdAt = `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`;
    const isHoisted = role.hoist ? t(lang, 'yes') : t(lang, 'no');
    const isMentionable = role.mentionable ? t(lang, 'yes') : t(lang, 'no');
    const hexColor = role.hexColor.toUpperCase();

    // Key permissions mapping
    const permissionsMap = {
      Administrator: t(lang, 'perm_administrator'),
      ManageGuild: t(lang, 'perm_manage_guild'),
      ManageRoles: t(lang, 'perm_manage_roles'),
      ManageChannels: t(lang, 'perm_manage_channels'),
      KickMembers: t(lang, 'perm_kick_members'),
      BanMembers: t(lang, 'perm_ban_members'),
      ManageMessages: t(lang, 'perm_manage_messages'),
      MentionEveryone: t(lang, 'perm_mention_everyone'),
    };

    const keyPermissions = role.permissions.toArray()
      .filter(perm => permissionsMap[perm])
      .map(perm => `• ${permissionsMap[perm]}`);

    const permissionsText = keyPermissions.length > 0 
      ? keyPermissions.join('\n') 
      : t(lang, 'roleinfo_no_key_perms');

    // Embed construction
    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${t(lang, 'roleinfo_title', { name: role.name })}`)
      .setColor(role.color || 0x99AAB5)
      .addFields(
        { name: `🆔 ${t(lang, 'roleinfo_role_id')}`, value: `\`${role.id}\``, inline: true },
        { name: `👥 ${t(lang, 'roleinfo_member_count')}`, value: `**${memberCount}**`, inline: true },
        { name: `🎨 ${t(lang, 'roleinfo_color_code')}`, value: `\`${hexColor}\``, inline: true },
        { name: `📌 ${t(lang, 'roleinfo_hoisted')}`, value: isHoisted, inline: true },
        { name: `🔔 ${t(lang, 'roleinfo_mentionable')}`, value: isMentionable, inline: true },
        { name: `📅 ${t(lang, 'roleinfo_created_on')}`, value: createdAt, inline: true },
        { name: `🔑 ${t(lang, 'roleinfo_key_perms')}`, value: permissionsText, inline: false }
      )
      .setFooter({ text: t(lang, 'requested_by', { user: interaction.user.tag }), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};