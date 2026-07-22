const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Displays detailed information about a specific role')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role you want to inspect')
        .setRequired(true)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const guild = interaction.guild;

    // Fetch all members to accurately count how many users have this role
    await guild.members.fetch().catch(() => {});
    const memberCount = role.members.size;

    // Role properties
    const createdAt = `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`;
    const isHoisted = role.hoist ? 'Yes' : 'No';
    const isMentionable = role.mentionable ? 'Yes' : 'No';
    const hexColor = role.hexColor.toUpperCase();

    // Key permissions mapping
    const permissionsMap = {
      Administrator: 'Administrator',
      ManageGuild: 'Manage Server',
      ManageRoles: 'Manage Roles',
      ManageChannels: 'Manage Channels',
      KickMembers: 'Kick Members',
      BanMembers: 'Ban Members',
      ManageMessages: 'Manage Messages',
      MentionEveryone: 'Mention @everyone',
    };

    const keyPermissions = role.permissions.toArray()
      .filter(perm => permissionsMap[perm])
      .map(perm => `• ${permissionsMap[perm]}`);

    const permissionsText = keyPermissions.length > 0 
      ? keyPermissions.join('\n') 
      : 'No key/elevated permissions';

    // Embed construction
    const embed = new EmbedBuilder()
      .setTitle(`🎭 Role Info: ${role.name}`)
      .setColor(role.color || 0x99AAB5)
      .addFields(
        { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
        { name: '👥 Member Count', value: `**${memberCount}**`, inline: true },
        { name: '🎨 Color Code', value: `\`${hexColor}\``, inline: true },
        { name: '📌 Displayed Separately?', value: isHoisted, inline: true },
        { name: '🔔 Mentionable?', value: isMentionable, inline: true },
        { name: '📅 Created On', value: createdAt, inline: true },
        { name: '🔑 Key Permissions', value: permissionsText, inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
