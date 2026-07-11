const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const historyFilePath = path.join(__dirname, '../dossiers.json');

function getHistory() {
    if (!fs.existsSync(historyFilePath)) fs.writeFileSync(historyFilePath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
}
function saveHistory(data) {
    fs.writeFileSync(historyFilePath, JSON.stringify(data, null, 4));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dossier')
        .setDescription('View or update a user\'s record file.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('Check a user\'s logged background history.')
            .addUserOption(opt => opt.setName('target').setDescription('The user to view').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('note')
            .setDescription('Add a formal staff note or warning tracking point to a user.')
            .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Details about why this note is added').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('target');
        const database = getHistory();

        // Make sure user profile template structure exists
        if (!database[target.id]) {
            database[target.id] = {
                username: target.tag,
                notes: [],
                punishments: 0
            };
        }

        if (subcommand === 'note') {
            const reason = interaction.options.getString('reason');
            const noteEntry = `[${new Date().toLocaleDateString()}] By ${interaction.user.tag}: ${reason}`;
            
            database[target.id].notes.push(noteEntry);
            saveHistory(database);

            return interaction.reply({
                content: `✅ Successfully appended staff log update to **${target.username}**'s profile dossier.`,
                ephemeral: true
            });
        }

        if (subcommand === 'view') {
            const profile = database[target.id];
            const logsDisplay = profile.notes.length > 0 ? profile.notes.join('\n') : '*No administrative notes or infraction history found on file.*';

            const embed = new EmbedBuilder()
                .setTitle(`📁 User Case File: ${target.username}`)
                .setDescription(`Internal staff database records tracking for ${target}.`)
                .setColor(0x2B2D31)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'User ID', value: `\`${target.id}\``, inline: true },
                    { name: 'Joined Discord', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Logged Administrative File Notes', value: logsDisplay }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true }); // Keeps profile records private to the staff channel
        }
    },
};
