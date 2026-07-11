const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Restricts to staff
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
        const subcommand = interaction.options.getSubcommand();
        const tasks = getTasks();

        if (subcommand === 'assign') {
            const staff = interaction.options.getUser('staff');
            const duty = interaction.options.getString('duty');
            const taskId = Math.random().toString(36).substring(2, 7).toUpperCase(); // Quick random 5-letter ID

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
                .setTitle('📝 New Staff Duty Assigned')
                .setColor(0xE67E22)
                .addFields(
                    { name: 'Task ID', value: `\`${taskId}\``, inline: true },
                    { name: 'Assigned To', value: `${staff}`, inline: true },
                    { name: 'Duty', value: duty }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'list') {
            const taskIds = Object.keys(tasks);
            if (taskIds.length === 0) return interaction.reply({ content: 'No active tasks found.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('📋 Server Task List')
                .setColor(0x3498DB);

            taskIds.forEach(id => {
                const t = tasks[id];
                embed.addFields({
                    name: `Task [${t.id}] - ${t.status}`,
                    value: `**Assigned to:** <@${t.assignedTo}>\n**Duty:** ${t.duty}`
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'complete') {
            const id = interaction.options.getString('id').toUpperCase();
            if (!tasks[id]) return interaction.reply({ content: '❌ **Error:** Invalid Task ID.', ephemeral: true });

            if (tasks[id].assignedTo !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '⚠️ You can only complete tasks assigned directly to you.', ephemeral: true });
            }

            tasks[id].status = '🟢 Completed';
            // Optional: you can choose to delete it here, or keep it marked as finished
            const finishedTask = tasks[id];
            delete tasks[id]; // Clean up list after completion
            saveTasks(tasks);

            const embed = new EmbedBuilder()
                .setTitle('✅ Task Finished')
                .setColor(0x2ecc71)
                .setDescription(`Task \`${id}\` has been successfully cleared by ${interaction.user}.\n\n**Original Duty:** ${finishedTask.duty}`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
