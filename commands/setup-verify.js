const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Sets up the advanced verification message in this channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Premium looking embed with a thumbnail
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Verification')
            .setDescription(`Welcome to **${interaction.guild.name}**!\n\nTo ensure a safe community and prevent bots, we require all members to verify themselves.\n\n**Instructions:**\nClick the green **Verify Me!** button below to unlock all channels and start chatting.`)
            .setColor(0x2B2D31) // A sleek, dark invisible color that blends into Discord's dark mode
            .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }))
            .setFooter({ text: 'Secure Verification System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        // Button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verify Me!')
                .setEmoji('🔐')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({
            content: '✅ Advanced verification message deployed successfully!',
            ephemeral: true
        });
    },
};
