const VERIFIED_ROLE_ID = '1523972825025745066'; 

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Check if the interaction is a button click
        if (!interaction.isButton()) return;

        // Check if it's our verification button
        if (interaction.customId === 'verify_button') {
            const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);

            // If the role doesn't exist in the server
            if (!role) {
                return interaction.reply({
                    content: 'Error: The verification role could not be found. Please contact an administrator.',
                    ephemeral: true // Only visible to the user who clicked
                });
            }

            // Check if the member already has the role
            if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.reply({
                    content: 'You are already verified!',
                    ephemeral: true
                });
            }

            // Add the role to the member
            try {
                await interaction.member.roles.add(role);
                await interaction.reply({
                    content: 'You have been successfully verified! Enjoy your stay in the server. 🎉',
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error while adding verification role:', error);
                await interaction.reply({
                    content: 'Something went wrong while assigning the role. Does the bot have the correct permissions/hierarchy?',
                    ephemeral: true
                });
            }
        }
    },
};
