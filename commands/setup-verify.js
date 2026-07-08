const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Sets up the verification message in this channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Upgraded verification embed
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Verification')
            .setDescription(`Welcome to **${interaction.guild.name}**! \n\nTo keep the server safe and gain access to all the channels, please take a moment to verify yourself.\n\n**What do you need to do?**\nSimply click the green button below to get instant access. Enjoy your stay!`)
            .setColor(0x5865F2) // Discord Blurple color
            .setFooter({ text: 'Verification System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        // Button with an icon
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verify Me!')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

        // Send the message into the channel
        await interaction.channel.send({ embeds: [embed], components: [row] });

        // Admin confirmation (invisible to others)
        await interaction.reply({
            content: '✅ The verification message has been successfully deployed!',
            ephemeral: true
        });
    },
};
