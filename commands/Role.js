const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

const STAFF_ROLES = ['1501587705983930570', '1417768129710522448', '1515080966526472302', '1498424210010275971', '1516788201983836311'];
const OWNER_IDS = ['1206537466597613628'];

function isStaff(member) {
  if (OWNER_IDS.includes(member.id)) return true;
  return STAFF_ROLES.some(id => member.roles.cache.has(id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role to a member')
        .addUserOption(opt => opt.setName('member').setDescription('Member to give the role to').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt => opt.setName('member').setDescription('Member to remove the role from').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    ),

  async execute(interaction, client) {
    const lang = await getGuildLang(interaction.guildId);

    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: t(lang, 'only_staff_command'), flags: 64 });
    }

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('member');
    const role = interaction.options.getRole('role');
    const guild = interaction.guild;

    let member;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({ content: t(lang, 'role_member_not_found'), flags: 64 });
    }

    // Check if bot's role is high enough
    const botMember = await guild.members.fetchMe();
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: t(lang, 'role_hierarchy_error', { role: role.name }), flags: 64 });
    }

    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: t(lang, 'role_already_has', { user: targetUser.id, role: role.name }), flags: 64 });
      }

      try {
        await member.roles.add(role.id);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`✅ ${t(lang, 'role_add_title')}`)
            .setColor(0x00cc66)
            .setDescription(t(lang, 'role_add_desc', { roleId: role.id, userId: targetUser.id }))
            .setFooter({ text: t(lang, 'role_done_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to add role:', err.message);
        return interaction.reply({ content: t(lang, 'role_add_failed'), flags: 64 });
      }
    }

    if (sub === 'remove') {
      if (!member.roles.cache.has(role.id)) {
        return interaction.reply({ content: t(lang, 'role_does_not_have', { user: targetUser.id, role: role.name }), flags: 64 });
      }

      try {
        await member.roles.remove(role.id);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`✅ ${t(lang, 'role_remove_title')}`)
            .setColor(0xff4444)
            .setDescription(t(lang, 'role_remove_desc', { roleId: role.id, userId: targetUser.id }))
            .setFooter({ text: t(lang, 'role_done_by', { user: interaction.user.username }) })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to remove role:', err.message);
        return interaction.reply({ content: t(lang, 'role_remove_failed'), flags: 64 });
      }
    }
  }
};