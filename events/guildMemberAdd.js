const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const pool = require('../database');

// ── Canvas welcome image ──────────────────────────────────────────────────────
// Design: blurred/dimmed version of the user's own avatar fills the background,
// their avatar circle sits centered on top, and their username is below it.
// Clean, personal, zero external assets needed.
async function renderWelcomeImage(member) {
  const width = 700, height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });

  // Background — dark gradient so text is always readable
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(1, '#16213e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Try to load and tile the avatar as a blurred background texture
  try {
    const avatarImg = await loadImage(avatarURL);

    // Draw avatar stretched across the whole background at low opacity
    ctx.globalAlpha = 0.15;
    ctx.drawImage(avatarImg, 0, 0, width, height);
    ctx.globalAlpha = 1.0;

    // Dark overlay to keep it subtle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, width, height);
  } catch (err) {
    console.error('Background avatar load failed:', err.message);
  }

  // Accent line at the top
  const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
  accentGrad.addColorStop(0, '#7289da');
  accentGrad.addColorStop(1, '#5865f2');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, width, 4);

  // Avatar circle — centered vertically, left-aligned with padding
  const avatarSize = 160;
  const avatarX = 45;
  const avatarY = height / 2 - avatarSize / 2;

  try {
    const avatarImg = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    console.error('Avatar load failed:', err.message);
    // Fallback: solid circle
    ctx.fillStyle = '#5865f2';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Avatar border ring
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#7289da';
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Text — right of the avatar
  const textX = avatarX + avatarSize + 30;
  const centerY = height / 2;

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WELCOME TO THE SERVER', textX, centerY - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px sans-serif';
  const displayName = member.user.username.slice(0, 20);
  ctx.fillText(displayName, textX, centerY + 10);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount}`, textX, centerY + 42);

  return canvas.toBuffer('image/png');
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guild = member.guild;

    // Fetch config for this server
    let config;
    try {
      const { rows } = await pool.query(`SELECT * FROM welcome_config WHERE guild_id = $1`, [guild.id]);
      config = rows[0];
    } catch (err) {
      console.error('Failed to fetch welcome config:', err.message);
      return;
    }

    if (!config) return; // Welcome system not set up for this server

    // 1. Give the auto role
    if (config.role_id) {
      try {
        await member.roles.add(config.role_id);
      } catch (err) {
        console.error(`Failed to give welcome role to ${member.user.tag}:`, err.message);
      }
    }

    // 2. Generate the welcome image
    let attachment = null;
    try {
      const imageBuffer = await renderWelcomeImage(member);
      attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
    } catch (err) {
      console.error('Failed to render welcome image:', err.message);
    }

    // 3. Send to welcome channel
    if (config.channel_id) {
      try {
        const channel = guild.channels.cache.get(config.channel_id);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0x7289da)
            .setTitle(`👋 Welcome, ${member.user.username}!`)
            .setDescription(`<@${member.id}> just joined **${guild.name}**!\nYou are member **#${guild.memberCount}**.`)
            .setTimestamp();

          if (attachment) embed.setImage('attachment://welcome.png');

          await channel.send({
            embeds: [embed],
            files: attachment ? [attachment] : []
          });
        }
      } catch (err) {
        console.error('Failed to send welcome message:', err.message);
      }
    }

    // 4. Send DM to the new member
    if (config.dm_message) {
      try {
        const dmText = config.dm_message.replace('{user}', member.user.username);
        await member.send(dmText);
      } catch (err) {
        // DMs can be disabled by the user — not a bot error
        console.log(`Could not DM ${member.user.tag} (DMs likely disabled)`);
      }
    }
  }
};