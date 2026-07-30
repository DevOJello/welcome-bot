const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// In-memory AFK store: userId -> { reason, since, guildId }
const afkUsers = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for being AFK (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';
    const member = interaction.member;

    // Save AFK state (no need to hardcode originalNick anymore)
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

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xffa500)
        .setDescription(`💤 **${member.user.username}** is now AFK: *${reason}*`)]
    });
  },

  afkUsers,
};
