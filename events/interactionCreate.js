const { EmbedBuilder } = require('discord.js');

// Server configuration IDs
const VERIFIED_ROLE_ID = '1523972825025745066'; 
const MEMBER_ROLE_ID = '1511396122483228896'; 

// Optional: Fill these in if you want to use the logging or unverified features
const LOG_CHANNEL_ID = '1524391586295976097'; 
const UNVERIFIED_ROLE_ID = '1523972756297744444'; 

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'verify_button') {
            const verifiedRole = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
            const memberRole = interaction.guild.roles.cache.get(MEMBER_ROLE_ID);
            const unverifiedRole = interaction.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            // Safety check: ensure both main roles exist in the guild cache
            if (!verifiedRole || !memberRole) {
                return interaction.reply({
                    content: '❌ **System Error:** The verification or member role could not be found. Please contact an Admin.',
                    ephemeral: true 
                });
            }

            // Check if the user already has both roles
            if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID) && interaction.member.roles.cache.has(MEMBER_ROLE_ID)) {
                return interaction.reply({
                    content: 'You are already verified and have the member role! 🎉',
                    ephemeral: true
                });
            }

            try {
                // Add both roles simultaneously
                await interaction.member.roles.add([verifiedRole, memberRole]);

                // Strip the unverified role if you're using it
                if (unverifiedRole && interaction.member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    await interaction.member.roles.remove(unverifiedRole);
                }

                // Clean success pop-up for the user
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Access Granted!')
                    .setDescription('Your verification was successful. You have been given the **Verified** and **Member** roles!')
                    .setColor(0x2ecc71); 

                await interaction.reply({
                    embeds: [successEmbed],
                    ephemeral: true
                });

                // Drop a clean DM to welcome them
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`Welcome to ${interaction.guild.name}! 🎊`)
                    .setDescription('Thanks for verifying! You now have full access to the server channels. Have fun!')
                    .setColor(0x5865F2);

                await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
                    console.log(`Could not send DM to ${interaction.user.tag} because their DMs are closed.`);
                });

                // Send logs to your admin channel if configured
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
                await interaction.reply({
                    content: '⚠️ **Error:** Could not update your roles. Please ensure the bot\'s role is positioned *above* both the Verified and Member roles in the server settings.',
                    ephemeral: true
                });
            }
        }
    },
};
