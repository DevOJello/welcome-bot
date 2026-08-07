const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { t } = require('../locales');
const { getGuildLang } = require('../utils/getLang');

const tasksFilePath = path.join(__dirname, '../tasks.json');

// Helper to read/write tasks safely
function getTasks() {
    if (!fs.existsSync(tasksFilePath)) fs.writeFileSync(tasksFilePath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(tasksFilePath, 'utf-8'));
}
function saveTasks(data) {
    fs.writeFileSync(tasksFilePath, JSON.stringify(data, null, 4));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('task')
        .setDescription('Manage staff assignments and duties.')
        .setDescriptionLocalizations({
          'nl': 'Beheer staftaken en opdrachten.',
          'fr': 'Gérer les attributions et les tâches du personnel.',
          'hi': 'स्टाफ असाइनमेंट और कर्तव्यों का प्रबंधन करें।'
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub
            .setName('assign')
            .setDescription('Assign a new duty to a staff member.')
            .setDescriptionLocalizations({
              'nl': 'Wijs een nieuwe taak toe aan een staflid.',
              'fr': 'Attribuer une nouvelle tâche à un membre du personnel.',
              'hi': 'स्टाफ सदस्य को नया कर्तव्य सौंपें।'
            })
            .addUserOption(opt => opt.setName('staff').setDescription('The moderator').setDescriptionLocalizations({ 'nl': 'De moderator', 'fr': 'Le modérateur', 'hi': 'मॉडरेटर' }).setRequired(true))
            .addStringOption(opt => opt.setName('duty').setDescription('What needs to be done?').setDescriptionLocalizations({ 'nl': 'Wat moet er gebeuren?', 'fr': 'Que faut-il faire ?', 'hi': 'क्या करने की आवश्यकता है?' }).setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all active server tasks.')
            .setDescriptionLocalizations({
              'nl': 'Toon alle actieve servertaken.',
              'fr': 'Lister toutes les tâches actives du serveur.',
              'hi': 'सभी सक्रिय सर्वर कार्य सूचीबद्ध करें।'
            }))
        .addSubcommand(sub => sub
            .setName('complete')
            .setDescription('Mark a task assigned to you as completed.')
            .setDescriptionLocalizations({
              'nl': 'Markeer een aan jou toegewezen taak als voltooid.',
              'fr': 'Marquer une tâche qui vous est attribuée comme terminée.',
              'hi': 'आपको सौंपे गए कार्य को पूर्ण के रूप में चिह्नित करें।'
            })
            .addStringOption(opt => opt.setName('id').setDescription('The unique Task ID').setDescriptionLocalizations({ 'nl': 'De unieke taak-ID', 'fr': 'L\'identifiant unique de la tâche', 'hi': 'अद्वितीय कार्य आईडी' }).setRequired(true))),

    async execute(interaction) {
        const lang = await getGuildLang(interaction.guildId);
        const subcommand = interaction.options.getSubcommand();
        const tasks = getTasks();

        if (subcommand === 'assign') {
            const staff = interaction.options.getUser('staff');
            const duty = interaction.options.getString('duty');
            const taskId = Math.random().toString(36).substring(2, 7).toUpperCase();

            tasks[taskId] = {
                id: taskId,
                assignedTo: staff.id,
                assignedBy: interaction.user.id,
                duty: duty,
                status: '🔴 Pending',
                timestamp: Date.now()
            };
            saveTasks(tasks);

            const embed = new EmbedBuilder()
                .setTitle(`📝 ${t(lang, 'task_assigned_title')}`)
                .setColor(0xE67E22)
                .addFields(
                    { name: t(lang, 'task_id'), value: `\`${taskId}\``, inline: true },
                    { name: t(lang, 'assigned_to'), value: `${staff}`, inline: true },
                    { name: t(lang, 'duty'), value: duty }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'list') {
            const taskIds = Object.keys(tasks);
            if (taskIds.length === 0) return interaction.reply({ content: t(lang, 'task_no_active'), flags: 64 });

            const embed = new EmbedBuilder()
                .setTitle(`📋 ${t(lang, 'task_list_title')}`)
                .setColor(0x3498DB);

            taskIds.forEach(id => {
                const tObj = tasks[id];
                embed.addFields({
                    name: t(lang, 'task_field_header', { id: tObj.id, status: tObj.status }),
                    value: `**${t(lang, 'assigned_to')}:** <@${tObj.assignedTo}>\n**${t(lang, 'duty')}:** ${tObj.duty}`
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'complete') {
            const id = interaction.options.getString('id').toUpperCase();
            if (!tasks[id]) return interaction.reply({ content: t(lang, 'task_invalid_id'), flags: 64 });

            if (tasks[id].assignedTo !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: t(lang, 'task_complete_permission'), flags: 64 });
            }

            tasks[id].status = '🟢 Completed';
            const finishedTask = tasks[id];
            delete tasks[id];
            saveTasks(tasks);

            const embed = new EmbedBuilder()
                .setTitle(`✅ ${t(lang, 'task_finished_title')}`)
                .setColor(0x2ecc71)
                .setDescription(t(lang, 'task_finished_desc', { id, user: interaction.user, duty: finishedTask.duty }))
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};