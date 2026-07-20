const { EmbedBuilder } = require('discord.js');

// Server configuration IDs for Verification
const VERIFIED_ROLE_ID = '1523972825025745066'; 
const MEMBER_ROLE_ID = '1511396122483228896'; 
const LOG_CHANNEL_ID = '1524391586295976097'; 
const UNVERIFIED_ROLE_ID = '1523972756297744444'; 

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // We skippen alles wat geen knop is
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
            const verifiedRole = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
            const memberRole = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
            const unverifiedRole = interaction.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            // Safety check
            if (!verifiedRole || !memberRole) {
                return interaction.reply({
                    content: '❌ **System Error:** The verification or member role could not be found. Please contact an Admin.',
                    ephemeral: true 
                });
            }

            // Check if already verified
            if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID) && interaction.member.roles.cache.has(MEMBER_ROLE_ID)) {
                return interaction.reply({
                    content: 'You are already verified and have the member role! 🎉',
                    ephemeral: true
                });
            }

            try {
                // Add roles simultaneously
                await interaction.member.roles.add([verifiedRole, memberRole]);

                // Strip unverified role if present
                if (unverifiedRole && interaction.member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    await interaction.member.roles.remove(unverifiedRole);
                }

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Access Granted!')
                    .setDescription('Your verification was successful. You have been given the **Verified** and **Member** roles!')
                    .setColor(0x2ecc71); 

                await interaction.reply({
                    embeds: [successEmbed],
                    ephemeral: true
                });

                // Send DM
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`Welcome to ${interaction.guild.name}! 🎊`)
                    .setDescription('Thanks for verifying! You now have full access to the server channels. Have fun!')
                    .setColor(0x5865F2);

                await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
                    console.log(`Could not send DM to ${interaction.user.tag} because their DMs are closed.`);
                });

                // Logging
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📥 New User Verified')
                        .setColor(0x2ecc71)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: 'User', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                            { name: 'User ID', value: `\`${interaction.user.id}\``, inline: true },
                            { name: 'Roles Assigned', value: `🟢 ${verifiedRole.name}\n🟢 ${memberRole.name}` }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Verification Logs' });

                    await logChannel.send({ embeds: [logEmbed] });
                }

            } catch (error) {
                console.error('Verification Error:', error);
                
                if (interaction.replied || interaction.deferred) {
                    return interaction.followUp({
                        content: '⚠️ **Error:** Could not update your roles. Check role hierarchy!',
                        ephemeral: true
                    });
                }
                
                await interaction.reply({
                    content: '⚠️ **Error:** Could not update your roles. Please ensure the bot\'s role is positioned *above* both the Verified and Member roles in the server settings.',
                    ephemeral: true
                });
            }
        }
    },
};
