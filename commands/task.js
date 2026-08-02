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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub
            .setName('assign')
            .setDescription('Assign a new duty to a staff member.')
            .addUserOption(opt => opt.setName('staff').setDescription('The moderator').setRequired(true))
            .addStringOption(opt => opt.setName('duty').setDescription('What needs to be done?').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all active server tasks.'))
        .addSubcommand(sub => sub
            .setName('complete')
            .setDescription('Mark a task assigned to you as completed.')
            .addStringOption(opt => opt.setName('id').setDescription('The unique Task ID').setRequired(true))),

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