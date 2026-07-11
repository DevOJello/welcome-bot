const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── Member Count Config ───────────────────────────────────────────────────────
const MEMBER_COUNT_CHANNEL_ID = '1524405788347600936';
const VERIFIED_COUNT_CHANNEL_ID = '1524406634871394485';
const VERIFIED_ROLE_ID = '1523972825025745066';

// ── Dashboard Config ──────────────────────────────────────────────────────────
const LOG_CHANNEL_ID = '1525639883412996116';
const historyFilePath = path.join(__dirname, '../dossiers.json');

let dashboardSentThisWeek = false;

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        console.log(`🤖 Oscar is online and authenticated as ${client.user.tag}!`);

        // ── Member Count Loop (every 10 minutes) ─────────────────────────────
        setInterval(async () => {
            const guild = client.guilds.cache.first();
            if (!guild) return;
            try {
                await guild.members.fetch();
                const totalMembers = guild.memberCount;
                const verifiedMembers = guild.roles.cache.get(VERIFIED_ROLE_ID)?.members.size || 0;
                const memberChannel = guild.channels.cache.get(MEMBER_COUNT_CHANNEL_ID);
                const verifiedChannel = guild.channels.cache.get(VERIFIED_COUNT_CHANNEL_ID);
                if (memberChannel) await memberChannel.setName(`👥 Total Members: ${totalMembers}`);
                if (verifiedChannel) await verifiedChannel.setName(`🛡️ Verified: ${verifiedMembers}`);
                console.log('📊 Server counter channels updated successfully.');
            } catch (error) {
                console.error('Failed to update counter channels:', error);
            }
        }, 600000);

        // ── Weekly Dashboard Loop (every hour, fires on Sunday midnight) ──────
        setInterval(async () => {
            const now = new Date();

            // Reset guard on any day that isn't Sunday
            if (now.getDay() !== 0) {
                dashboardSentThisWeek = false;
                return;
            }

            // Only fire once at Sunday midnight
            if (now.getHours() !== 0 || dashboardSentThisWeek) return;
            dashboardSentThisWeek = true;

            const guild = client.guilds.cache.first();
            if (!guild) return;

            const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) return;

            if (!fs.existsSync(historyFilePath)) return;

            let database;
            try {
                database = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
            } catch (err) {
                console.error('Failed to read dossiers.json:', err.message);
                return;
            }

            let totalWarns = 0;
            const activeStaff = {};

            Object.values(database).forEach(userFile => {
                if (userFile.warns) totalWarns += userFile.warns.length;
                if (userFile.notes) {
                    userFile.notes.forEach(note => {
                        const match = note.match(/By (.+?):/);
                        if (match) {
                            const staffName = match[1];
                            activeStaff[staffName] = (activeStaff[staffName] || 0) + 1;
                        }
                    });
                }
            });

            const staffLeaderboard = Object.entries(activeStaff)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => `• **${name}**: ${count} actions`)
                .join('\n') || '*No staff actions logged this week.*';

            const reportEmbed = new EmbedBuilder()
                .setTitle('📈 Server Health Dashboard')
                .setDescription(`Weekly Analytics Report for **${guild.name}**`)
                .setColor(0x5865F2)
                .addFields(
                    { name: '🛡️ Moderation Metrics', value: `• **Total Warnings Issued:** ${totalWarns}\n• **Server Members:** ${guild.memberCount}`, inline: false },
                    { name: '📊 Staff Efficiency Leaderboard', value: staffLeaderboard, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Weekly Automatic Report' });

            await logChannel.send({ embeds: [reportEmbed] });
            console.log('✅ Weekly Health Dashboard dispatched.');
        }, 3600000);
    },
};
