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
        .setDescription('Complete staff command utility suite for user tracking.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // 1. VIEW DOSSIER
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('Check a user\'s file records and history.')
            .addUserOption(opt => opt.setName('target').setDescription('The user to look up').setRequired(true)))
        // 2. ADD NOTE
        .addSubcommand(sub => sub
            .setName('note')
            .setDescription('Add an administrative tracking note to a user.')
            .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('What to log').setRequired(true)))
        // 3. WARN USER
        .addSubcommand(sub => sub
            .setName('warn')
            .setDescription('Issue a formal staff warning point to a user.')
            .addUserOption(opt => opt.setName('target').setDescription('The user to warn').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true)))
        // 4. DELETE A RECORD
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Remove a single logged note or warning from a user\'s file.')
            .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
            .addStringOption(opt => opt.setName('type').setDescription('Select entry type').setRequired(true)
                .addChoices({ name: 'Note', value: 'notes' }, { name: 'Warning', value: 'warns' }))
            .addIntegerOption(opt => opt.setName('index').setDescription('The index position number (e.g., 1, 2, 3)').setRequired(true)))
        // 5. STAFF STATS LOOKUP
        .addSubcommand(sub => sub
            .setName('staffstats')
            .setDescription('Check the productivity logs of a moderator.')
            .addUserOption(opt => opt.setName('staff').setDescription('The moderator').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('target') || interaction.options.getUser('staff');
        const database = getHistory();

        // Make sure database structure is set up
        if (target && !database[target.id]) {
            database[target.id] = { username: target.tag, notes: [], warns: [] };
        }

        // --- SUBCOMMAND: NOTE ---
        if (subcommand === 'note') {
            const reason = interaction.options.getString('reason');
            const entry = `[${new Date().toLocaleDateString()}] By ${interaction.user.tag}: ${reason}`;
            database[target.id].notes.push(entry);
            saveHistory(database);

            return interaction.reply({ content: `✅ Appended profile note to **${target.username}**.`, ephemeral: true });
        }

        // --- SUBCOMMAND: WARN ---
        if (subcommand === 'warn') {
            const reason = interaction.options.getString('reason');
            const entry = `[${new Date().toLocaleDateString()}] By ${interaction.user.tag}: ${reason}`;
            if (!database[target.id].warns) database[target.id].warns = [];
            
            database[target.id].warns.push(entry);
            saveHistory(database);

            // Attempt to DM the warned user
            try {
                await target.send(`⚠️ **Warning from ${interaction.guild.name}:**\nReason: ${reason}`);
            } catch {
                console.log(`Couldn't DM warning notification to ${target.tag}.`);
            }

            return interaction.reply({ content: `⚠️ **Warning Logged:** Successfully warned ${target} for: *${reason}*` });
        }

        // --- SUBCOMMAND: DELETE ---
        if (subcommand === 'delete') {
            const type = interaction.options.getString('type');
            const index = interaction.options.getInteger('index') - 1; // Converts human layout to array 0-indexing

            const fileArray = database[target.id][type];
            if (!fileArray || index < 0 || index >= fileArray.length) {
                return interaction.reply({ content: '❌ **Error:** No record found at that index location number.', ephemeral: true });
            }

            const removedItem = fileArray.splice(index, 1);
            saveHistory(database);

            return interaction.reply({ content: `✅ Successfully cleared record index \`#${index + 1}\` from **${target.username}**'s case file.\n> *Removed: ${removedItem}*`, ephemeral: true });
        }

        // --- SUBCOMMAND: VIEW ---
        if (subcommand === 'view') {
            const profile = database[target.id];
            if (!profile.warns) profile.warns = [];

            const formattedNotes = profile.notes.map((n, idx) => `\`[#${idx + 1}]\` ${n}`).join('\n') || '*No logged notes on file.*';
            const formattedWarns = profile.warns.map((w, idx) => `\`[#${idx + 1}]\` ${w}`).join('\n') || '*No active warnings on file.*';

            const embed = new EmbedBuilder()
                .setTitle(`📁 User Dossier: ${target.username}`)
                .setColor(0x2B2D31)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '🆔 User ID', value: `\`${target.id}\``, inline: true },
                    { name: '⚠️ Active Warnings Count', value: `\`${profile.warns.length}\``, inline: true },
                    { name: '📝 Administrative Staff Notes', value: formattedNotes },
                    { name: '⚠️ formal Disciplinary Warnings History', value: formattedWarns }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- SUBCOMMAND: STAFF STATS ---
        if (subcommand === 'staffstats') {
            let actionsCount = 0;

            Object.values(database).forEach(userFile => {
                const checkActions = (arr) => arr?.forEach(entry => { if (entry.includes(`By ${target.tag}`)) actionsCount++; });
                checkActions(userFile.notes);
                checkActions(userFile.warns);
            });

            const embed = new EmbedBuilder()
                .setTitle(`📊 Staff Productivity File: ${target.username}`)
                .setColor(0x2ecc71)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setDescription(`This moderator has registered a combined total of **${actionsCount}** documented operations (Notes/Warnings) across the server file indices.`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
