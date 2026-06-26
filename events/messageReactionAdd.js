const pool = require('../database');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;

    // Fetch partial reaction/message if needed
    if (reaction.partial) {
      try { await reaction.fetch(); } catch (err) { console.error('Failed to fetch reaction:', err.message); return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch (err) { console.error('Failed to fetch message:', err.message); return; }
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const emoji = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` // custom emoji
      : reaction.emoji.name; // unicode emoji

    const { rows } = await pool.query(`
      SELECT role_id FROM reaction_roles
      WHERE guild_id = $1 AND message_id = $2 AND emoji = $3
    `, [guild.id, reaction.message.id, emoji]);

    if (rows.length === 0) return;

    try {
      const member = await guild.members.fetch(user.id);
      await member.roles.add(rows[0].role_id);
    } catch (err) {
      console.error(`Failed to add role on reaction: ${err.message}`);
    }
  }
};