const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '⛔ Only staff can use this command.', flags: 64 });
    }
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('member');
    const role = interaction.options.getRole('role');
    const guild = interaction.guild;
    let member;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({ content: '⚠️ Could not find that member in this server.', flags: 64 });
    }
    // Check if bot's role is high enough
    const botMember = await guild.members.fetchMe();
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: `⚠️ I can't manage the **${role.name}** role — it's higher than or equal to my highest role.`, flags: 64 });
    }
    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: `⚠️ <@${targetUser.id}> already has the **${role.name}** role.`, flags: 64 });
      }
      try {
        await member.roles.add(role.id);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('✅ Role Added')
            .setColor(0x00cc66)
            .setDescription(`<@&${role.id}> has been given to <@${targetUser.id}>.`)
            .setFooter({ text: `Done by ${interaction.user.username}` })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to add role:', err.message);
        return interaction.reply({ content: '❌ Failed to add the role. Check my permissions.', flags: 64 });
      }
    }
    if (sub === 'remove') {
      if (!member.roles.cache.has(role.id)) {
        return interaction.reply({ content: `⚠️ <@${targetUser.id}> doesn't have the **${role.name}** role.`, flags: 64 });
      }
      try {
        await member.roles.remove(role.id);
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('✅ Role Removed')
            .setColor(0xff4444)
            .setDescription(`<@&${role.id}> has been removed from <@${targetUser.id}>.`)
            .setFooter({ text: `Done by ${interaction.user.username}` })
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to remove role:', err.message);
        return interaction.reply({ content: '❌ Failed to remove the role. Check my permissions.', flags: 64 });
      }
    }
  }
};
