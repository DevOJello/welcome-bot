const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Note: For a production bot, you should fetch/save this data from a database (e.g., MongoDB, Quick.db)
const staffData = new Map(); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staffstats')
        .setDescription('View the management and moderation activity of a staff member.')
        .addUserOption(option => option.setName('target').setDescription('The moderator to check').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        
        // Fallback data structure if the staff member has no logs yet
        const stats = staffData.get(target.id) || { ticketsClosed: 0, messagesCleared: 0, warnsGiven: 0 };

        const embed = new EmbedBuilder()
            .setTitle(`📊 Staff Activity: ${target.username}`)
            .setColor(0x5865F2)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎟️ Tickets Resolved', value: `\`${stats.ticketsClosed}\``, inline: true },
                { name: '🧹 Messages Cleared', value: `\`${stats.messagesCleared}\``, inline: true },
                { name: '⚠️ Warnings Issued', value: `\`${stats.warnsGiven}\``, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Oscar Management Utility' });

        await interaction.reply({ embeds: [embed] });
    },
};
