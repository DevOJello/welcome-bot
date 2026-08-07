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
        .setDescriptionLocalizations({
            'nl': 'Volledige staff-commandohulpmiddelenset voor gebruikersbeheer.',
            'fr': 'Suite complète d\'utilitaires de commande pour le suivi des utilisateurs.',
            'hi': 'उपयोगकर्ता ट्रैकिंग के लिए पूर्ण स्टाफ कमांड यूटिलिटी सूट।'
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // 1. VIEW DOSSIER
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('Check a user\'s file records and history.')
            .setDescriptionLocalizations({
                'nl': 'Bekijk de dossiergegevens en geschiedenis van een gebruiker.',
                'fr': 'Consulter les dossiers et l\'historique d\'un utilisateur.',
                'hi': 'किसी उपयोगकर्ता के फ़ाइल रिकॉर्ड और इतिहास की जाँच करें।'
            })
            .addUserOption(opt => opt.setName('target')
                .setDescription('The user to look up')
                .setDescriptionLocalizations({
                    'nl': 'De op te zoeken gebruiker',
                    'fr': 'L\'utilisateur à rechercher',
                    'hi': 'खोजने के लिए उपयोगकर्ता'
                })
                .setRequired(true)))
        // 2. ADD NOTE
        .addSubcommand(sub => sub
            .setName('note')
            .setDescription('Add an administrative tracking note to a user.')
            .setDescriptionLocalizations({
                'nl': 'Voeg een administratieve notitie toe aan een gebruiker.',
                'fr': 'Ajouter une note de suivi administratif à un utilisateur.',
                'hi': 'किसी उपयोगकर्ता में प्रशासनिक ट्रैकिंग नोट जोड़ें।'
            })
            .addUserOption(opt => opt.setName('target')
                .setDescription('The user')
                .setDescriptionLocalizations({
                    'nl': 'De gebruiker',
                    'fr': 'L\'utilisateur',
                    'hi': 'उपयोगकर्ता'
                })
                .setRequired(true))
            .addStringOption(opt => opt.setName('reason')
                .setDescription('What to log')
                .setDescriptionLocalizations({
                    'nl': 'Wat er gelogd moet worden',
                    'fr': 'Ce qu\'il faut consigner',
                    'hi': 'क्या लॉग करना है'
                })
                .setRequired(true)))
        // 3. WARN USER
        .addSubcommand(sub => sub
            .setName('warn')
            .setDescription('Issue a formal staff warning point to a user.')
            .setDescriptionLocalizations({
                'nl': 'Geef een formele waarschuwing aan een gebruiker.',
                'fr': 'Émettre un avertissement officiel à un utilisateur.',
                'hi': 'किसी उपयोगकर्ता को औपचारिक स्टाफ चेतावनी अंक जारी करें।'
            })
            .addUserOption(opt => opt.setName('target')
                .setDescription('The user to warn')
                .setDescriptionLocalizations({
                    'nl': 'De te waarschuwen gebruiker',
                    'fr': 'L\'utilisateur à avertir',
                    'hi': 'चेतावनी देने के लिए उपयोगकर्ता'
                })
                .setRequired(true))
            .addStringOption(opt => opt.setName('reason')
                .setDescription('Reason for warning')
                .setDescriptionLocalizations({
                    'nl': 'Reden voor de waarschuwing',
                    'fr': 'Raison de l\'avertissement',
                    'hi': 'चेतावनी का कारण'
                })
                .setRequired(true)))
        // 4. DELETE A RECORD
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Remove a single logged note or warning from a user\'s file.')
            .setDescriptionLocalizations({
                'nl': 'Verwijder een enkele notitie of waarschuwing uit een gebruikersdossier.',
                'fr': 'Supprimer une note ou un avertissement enregistré du dossier d\'un utilisateur.',
                'hi': 'किसी उपयोगकर्ता की फ़ाइल से एक एकल लॉग किया गया नोट या चेतावनी हटाएं।'
            })
            .addUserOption(opt => opt.setName('target')
                .setDescription('The user')
                .setDescriptionLocalizations({
                    'nl': 'De gebruiker',
                    'fr': 'L\'utilisateur',
                    'hi': 'उपयोगकर्ता'
                })
                .setRequired(true))
            .addStringOption(opt => opt.setName('type')
                .setDescription('Select entry type')
                .setDescriptionLocalizations({
                    'nl': 'Selecteer berichttype',
                    'fr': 'Sélectionner le type d\'entrée',
                    'hi': 'प्रविष्टि प्रकार चुनें'
                })
                .setRequired(true)
                .addChoices({ name: 'Note', value: 'notes' }, { name: 'Warning', value: 'warns' }))
            .addIntegerOption(opt => opt.setName('index')
                .setDescription('The index position number (e.g., 1, 2, 3)')
                .setDescriptionLocalizations({
                    'nl': 'Het indexnummer (bijv. 1, 2, 3)',
                    'fr': 'Le numéro de position de l\'index (ex. 1, 2, 3)',
                    'hi': 'इंडेक्स स्थिति संख्या (उदा., 1, 2, 3)'
                })
                .setRequired(true)))
        // 5. STAFF STATS LOOKUP
        .addSubcommand(sub => sub
            .setName('staffstats')
            .setDescription('Check the productivity logs of a moderator.')
            .setDescriptionLocalizations({
                'nl': 'Bekijk de productiviteitslogs van een moderator.',
                'fr': 'Vérifier les journaux de productivité d\'un modérateur.',
                'hi': 'किसी मॉडरेटर के उत्पादकता लॉग की जाँच करें।'
            })
            .addUserOption(opt => opt.setName('staff')
                .setDescription('The moderator')
                .setDescriptionLocalizations({
                    'nl': 'De moderator',
                    'fr': 'Le modérateur',
                    'hi': 'मॉडरेटर'
                })
                .setRequired(true))),

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

            return interaction.reply({ content: `✅ Appended profile note to **${target.username}**.`, flags: 64 });
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
                return interaction.reply({ content: '❌ **Error:** No record found at that index location number.', flags: 64 });
            }

            const removedItem = fileArray.splice(index, 1);
            saveHistory(database);

            return interaction.reply({ content: `✅ Successfully cleared record index \`#${index + 1}\` from **${target.username}**'s case file.\n> *Removed: ${removedItem}*`, flags: 64 });
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

            return interaction.reply({ embeds: [embed], flags: 64 });
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