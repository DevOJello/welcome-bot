const { EmbedBuilder } = require('discord.js');
const pool = require('../database');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const customId = interaction.customId;

        // ── 1. GIVEAWAY BUTTON HANDLER ────────────────────────────────────────
        if (customId.startsWith('giveaway_')) {
            const giveawayCommand = client.commands.get('giveaway');
            if (giveawayCommand && giveawayCommand.handleButton) {
                try {
                    return await giveawayCommand.handleButton(interaction, client);
                } catch (err) {
                    console.error('Error handling Giveaway button:', err);
                }
            }
            return;
        }

        // ── 2. VERIFICATION BUTTON HANDLER ────────────────────────────────────
        if (customId === 'verify_button') {
            // Defer the reply immediately to prevent the interaction from timing out (10062 unknown interaction)
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true });
            }

            const { rows } = await pool.query(`SELECT * FROM verify_config WHERE guild_id = $1`, [interaction.guild.id]);
            const config = rows[0];

            if (!config || !config.role_ids || config.role_ids.length === 0) {
                return interaction.editReply({
                    content: '❌ **System Error:** Verification hasn\'t been set up yet. Ask an admin to run `/setup-verify`.'
                });
            }

            const roles = config.role_ids
                .map(id => interaction.guild.roles.cache.get(id))
                .filter(Boolean);

            const unverifiedRole = config.unverified_role_id
                ? interaction.guild.roles.cache.get(config.unverified_role_id)
                : null;

            const logChannel = config.log_channel_id
                ? interaction.guild.channels.cache.get(config.log_channel_id)
                : null;

            if (roles.length === 0) {
                return interaction.editReply({
                    content: '❌ **System Error:** None of the configured roles could be found. Please contact an Admin.'
                });
            }

            // Check if the user already has all configured roles
            const alreadyHasAll = roles.every(r => interaction.member.roles.cache.has(r.id));
            if (alreadyHasAll) {
                return interaction.editReply({
                    content: 'You are already verified! 🎉'
                });
            }

            try {
                // Add all configured roles simultaneously
                await interaction.member.roles.add(roles);

                // Strip the unverified role if configured and present
                if (unverifiedRole && interaction.member.roles.cache.has(unverifiedRole.id)) {
                    await interaction.member.roles.remove(unverifiedRole);
                }

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Access Granted!')
                    .setDescription(`Your verification was successful. You've been given:\n${roles.map(r => `🟢 ${r}`).join('\n')}`)
                    .setColor(0x2ecc71);

                await interaction.editReply({
                    embeds: [successEmbed]
                });

                // Drop a clean DM to welcome them
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`Welcome to ${interaction.guild.name}! 🎊`)
                    .setDescription('Thanks for verifying! You now have full access to the server channels. Have fun!')
                    .setColor(0x5865F2);

                await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
                    console.log(`Could not send DM to ${interaction.user.tag} because their DMs are closed.`);
                });

                // Send logs to the configured admin channel
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📥 New User Verified')
                        .setColor(0x2ecc71)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: 'User', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                            { name: 'User ID', value: `\`${interaction.user.id}\``, inline: true },
                            { name: 'Roles Assigned', value: roles.map(r => `🟢 ${r.name}`).join('\n') }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Verification Logs' });

                    await logChannel.send({ embeds: [logEmbed] });
                }

            } catch (error) {
                console.error('Verification Error:', error);

                return interaction.editReply({
                    content: '⚠️ **Error:** Could not update your roles. Please ensure the bot\'s role is positioned *above* the configured verification roles in the server settings.'
                });
            }
        }
    },
};