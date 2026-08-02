const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pool = require('../database');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const guild = newMember.guild;

    // Detect new boost: didn't have boost before, has it now
    const justBoosted = !oldMember.premiumSince && newMember.premiumSince;
    if (!justBoosted) return;

    let config;
    try {
      const { rows } = await pool.query(`SELECT * FROM boost_config WHERE guild_id = $1`, [guild.id]);
      config = rows[0];
    } catch (err) {
      console.error('Failed to fetch boost config:', err.message);
      return;
    }

    if (!config) return;

    // Give booster role
    if (config.role_id) {
      try {
        await newMember.roles.add(config.role_id);
      } catch (err) {
        console.error(`Failed to give booster role to ${newMember.user.tag}:`, err.message);
      }
    }

    // Send thank you message
    if (config.channel_id) {
      try {
        const channel = guild.channels.cache.get(config.channel_id);
        if (!channel) return;

        const boostCount = guild.premiumSubscriptionCount;
        const text = config.message.replace('{user}', `<@${newMember.id}>`);

        await channel.send({
          embeds: [new EmbedBuilder()
            .setTitle('🚀 New Server Boost!')
            .setColor(0xff73fa)
            .setDescription(text)
            .setThumbnail(newMember.user.displayAvatarURL({ extension: 'png', size: 256 }))
            .addFields(
              { name: '✨ Booster', value: `<@${newMember.id}>`, inline: true },
              { name: '🔢 Total Boosts', value: `${boostCount}`, inline: true },
            )
            .setTimestamp()]
        });
      } catch (err) {
        console.error('Failed to send boost message:', err.message);
      }
    }
  }
};