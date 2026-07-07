const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Sets up the verification message in the current channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restricts this command to Administrators only

    async execute(interaction) {
        // Create the verification embed
        const embed = new EmbedBuilder()
            .setTitle('Server Verification')
            .setDescription('Welcome to the server! Click the green button below to verify yourself and gain access to the rest of the channels.')
            .setColor(0x2ecc71); // Green color

        // Create the button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button') // Handled in your interaction handler
                .setLabel('Verify Me!')
                .setStyle(ButtonStyle.Success) // Green button
        );

        // Send the verification message cleanly into the channel
        await interaction.channel.send({ embeds: [embed], components: [row] });

        // Reply to the admin ephemerally so the slash command registers as successful
        await interaction.reply({
            content: 'Verification message deployed successfully!',
            ephemeral: true
        });
    },
};
