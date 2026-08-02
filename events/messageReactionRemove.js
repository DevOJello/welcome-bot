const pool = require('../database');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user, client) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch (err) { console.error('Failed to fetch reaction:', err.message); return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch (err) { console.error('Failed to fetch message:', err.message); return; }
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const emoji = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    const { rows } = await pool.query(`
      SELECT role_id FROM reaction_roles
      WHERE guild_id = $1 AND message_id = $2 AND emoji = $3
    `, [guild.id, reaction.message.id, emoji]);

    if (rows.length === 0) return;

    try {
      const member = await guild.members.fetch(user.id);
      await member.roles.remove(rows[0].role_id);
    } catch (err) {
      console.error(`Failed to remove role on reaction remove: ${err.message}`);
    }
  }
};