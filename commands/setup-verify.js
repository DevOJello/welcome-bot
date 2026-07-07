const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'setup-verify',
    description: 'Sets up the verification message in the current channel.',
    async execute(message, args) {
        // Only administrators can run this command
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('You do not have permission to use this command!');
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setTitle('Server Verification')
            .setDescription('Welcome to the server! Click the green button below to verify yourself and gain access to the rest of the channels.')
            .setColor(0x2ecc71); // Green color

        // Create the button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button') // Used to detect the click in the event file
                .setLabel('Verify Me!')
                .setStyle(ButtonStyle.Success)
        );

        // Send the message and delete the admin's trigger message
        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(console.error);
    },
};
