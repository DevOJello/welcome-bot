const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // Lazy-load afkUsers from the afk command
    let afkCommand;
    try {
      afkCommand = client.commands.get('afk');
    } catch {}
    if (!afkCommand) return;

    const afkUsers = afkCommand.afkUsers;

    // ── Auto-remove AFK if the user sends a message ──────────────────────────
    if (afkUsers.has(message.author.id)) {
      const data = afkUsers.get(message.author.id);
      afkUsers.delete(message.author.id);

      const elapsed = Math.floor((Date.now() - data.since) / 1000);
      const duration = elapsed < 60
        ? `${elapsed}s`
        : elapsed < 3600
        ? `${Math.floor(elapsed / 60)}m`
        : `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;

      // Restore original nickname
      try {
        const member = await message.guild.members.fetch(message.author.id);
        await member.setNickname(data.originalNick === member.user.username ? null : data.originalNick);
      } catch {}

      try {
        const reply = await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x00cc66)
            .setDescription(`✅ Welcome back <@${message.author.id}>! AFK removed — you were away for **${duration}**.`)]
        });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
      } catch {}
    }

    // ── Notify when someone tags an AFK user ─────────────────────────────────
    const mentionedAfk = message.mentions.users.filter(u => afkUsers.has(u.id));

    for (const [userId, afkData] of mentionedAfk) {
      const elapsed = Math.floor((Date.now() - afkData.since) / 1000);
      const duration = elapsed < 60
        ? `${elapsed}s`
        : elapsed < 3600
        ? `${Math.floor(elapsed / 60)}m`
        : `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;

      try {
        const reply = await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xffa500)
            .setDescription(`💤 <@${userId}> is AFK: *${afkData.reason}* — away for **${duration}**`)]
        });
        setTimeout(() => reply.delete().catch(() => {}), 8000);
      } catch {}
    }
  }
};
