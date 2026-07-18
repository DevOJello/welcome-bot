const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// In-memory AFK store: userId -> { reason, since, guildId, originalNick }
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

  async execute(interaction, client) {
    const reason = interaction.options.getString('reason') || 'AFK';
    const member = interaction.member;
    const originalNick = member.nickname || member.user.username;

    afkUsers.set(interaction.user.id, {
      reason,
      since: Date.now(),
      guildId: interaction.guild.id,
      originalNick,
    });

    try {
      const newNick = `[AFK] ${originalNick}`.slice(0, 32);
      await member.setNickname(newNick);
    } catch {}

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xffa500)
        .setDescription(`💤 **${member.user.username}** is now AFK: *${reason}*`)]
    });
  },

  afkUsers,
};


