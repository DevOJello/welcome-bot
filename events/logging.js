const { EmbedBuilder } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

// Helper om logkanaal & instellingen op te halen
async function getGuildSettings(guild) {
  if (!guild) return null;
  const { rows } = await pool.query(`SELECT * FROM guild_settings WHERE guild_id = $1`, [guild.id]);
  return rows[0] || null;
}

module.exports = (client) => {

  // 💬 1. MESSAGES (Deleted / Edited)
  client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    const settings = await getGuildSettings(message.guild);
    if (!settings?.log_channel_id || settings.log_messages === false) return;

    const logChannel = message.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTitle(`Message deleted in #${message.channel.name}`)
      .setDescription(message.content || '*[No content / Attachment only]*')
      .setColor(0x3498db)
      .setFooter({ text: `Message ID: ${message.id} | Author ID: ${message.author.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const settings = await getGuildSettings(oldMessage.guild);
    if (!settings?.log_channel_id || settings.log_messages === false) return;

    const logChannel = oldMessage.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
      .setTitle(`Message edited in #${oldMessage.channel.name}`)
      .addFields(
        { name: 'Before', value: oldMessage.content || '*[Empty]*' },
        { name: 'After', value: newMessage.content || '*[Empty]*' }
      )
      .setColor(0xf1c40f)
      .setFooter({ text: `Message ID: ${oldMessage.id} | Author ID: ${oldMessage.author.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  // 👥 2. MEMBERS (Join / Leave)
  client.on('guildMemberAdd', async (member) => {
    const settings = await getGuildSettings(member.guild);
    if (!settings?.log_channel_id || settings.log_members === false) return;

    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('Member joined')
      .setColor(0x2ecc71)
      .setDescription(`<@${member.id}> joined the server.`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  client.on('guildMemberRemove', async (member) => {
    const settings = await getGuildSettings(member.guild);
    if (!settings?.log_channel_id || settings.log_members === false) return;

    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('Member left')
      .setColor(0xe74c3c)
      .setDescription(`<@${member.id}> left the server.`)
      .setFooter({ text: `User ID: ${member.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  // 🔊 3. VOICE CHANNELS (Join / Leave / Move)
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    const settings = await getGuildSettings(guild);
    if (!settings?.log_channel_id || settings.log_voice === false) return;

    const logChannel = guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const member = newState.member;
    const embed = new EmbedBuilder()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTimestamp();

    // Joined Voice Channel
    if (!oldState.channelId && newState.channelId) {
      embed.setTitle('Joined voice channel')
        .setDescription(`<@${member.id}> joined **#${newState.channel.name}**`)
        .setColor(0x2ecc71);
    }
    // Left Voice Channel
    else if (oldState.channelId && !newState.channelId) {
      embed.setTitle('Left voice channel')
        .setDescription(`<@${member.id}> left **#${oldState.channel.name}**`)
        .setColor(0xe74c3c);
    }
    // Switched Voice Channel
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      embed.setTitle('Switched voice channels')
        .setDescription(`<@${member.id}> moved from **#${oldState.channel.name}** to **#${newState.channel.name}**`)
        .setColor(0x3498db);
    } else {
      return; // Negeer Mute/Deafen updates
    }

    logChannel.send({ embeds: [embed] });
  });
};
