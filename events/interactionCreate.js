const { EmbedBuilder } = require('discord.js');

const VERIFIED_ROLE_ID = '1523972825025745066'; 

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'verify_button') {
            const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);

            if (!role) {
                return interaction.reply({
                    content: '❌ **Error:** The verification role could not be found. Please contact an administrator.',
                    ephemeral: true 
                });
            }

            // Check if the user already has the role
            if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.reply({
                    content: 'You are already verified! You can already access the full server. 🎉',
                    ephemeral: true
                });
            }

            try {
                // Add the role
                await interaction.member.roles.add(role);

                // Sleek success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Verification Successful!')
                    .setDescription('You now have full access to the server. Have fun!')
                    .setColor(0x2ecc71); // Green for success

                await interaction.reply({
                    embeds: [successEmbed],
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error while adding verification role:', error);
                await interaction.reply({
                    content: '⚠️ **Something went wrong!** The bot could not assign the role. Please ensure the bot\'s role is positioned *above* the verification role in the server settings.',
                    ephemeral: true
                });
            }
        }
    },
};
