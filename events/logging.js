const { EmbedBuilder } = require('discord.js');
const pool = require('../database');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

async function getLogChannel(guild) {
  if (!guild) return null;
  const { rows } = await pool.query(`SELECT log_channel_id FROM guild_settings WHERE guild_id = $1`, [guild.id]);
  if (!rows[0] || !rows[0].log_channel_id) return null;
  return guild.channels.cache.get(rows[0].log_channel_id) || null;
}

module.exports = (client) => {

  // 🗑️ 1. Message Deleted
  client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    const logChannel = await getLogChannel(message.guild);
    if (!logChannel) return;

    const lang = await getGuildLang(message.guild.id);

    const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTitle(`Message deleted in #${message.channel.name}`)
      .setDescription(message.content || '*[No content / Attachment only]*')
      .setColor(0x3498db)
      .setFooter({ text: `Message ID: ${message.id} | Author ID: ${message.author.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  // ✏️ 2. Message Edited
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const logChannel = await getLogChannel(oldMessage.guild);
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

  // 🖼️ 3. Avatar Update
  client.on('userUpdate', async (oldUser, newUser) => {
    client.guilds.cache.forEach(async (guild) => {
      const member = await guild.members.fetch(newUser.id).catch(() => null);
      if (!member) return;

      const logChannel = await getLogChannel(guild);
      if (!logChannel) return;

      if (oldUser.displayAvatarURL() !== newUser.displayAvatarURL()) {
        const embed = new EmbedBuilder()
          .setAuthor({ name: newUser.tag, iconURL: newUser.displayAvatarURL() })
          .setTitle('Avatar update')
          .setThumbnail(newUser.displayAvatarURL({ size: 256 }))
          .setColor(0x9b59b6)
          .setFooter({ text: `ID: ${newUser.id}` })
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }
    });
  });

  // 📥 4. Member Joined
  client.on('guildMemberAdd', async (member) => {
    const logChannel = await getLogChannel(member.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('Member joined')
      .setColor(0x2ecc71)
      .setDescription(`<@${member.id}> joined the server.`)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });

  // 📤 5. Member Left
  client.on('guildMemberRemove', async (member) => {
    const logChannel = await getLogChannel(member.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setTitle('Member left')
      .setColor(0xe74c3c)
      .setDescription(`<@${member.id}> left the server.`)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    logChannel.send({ embeds: [embed] });
  });
};
