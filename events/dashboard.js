const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const historyFilePath = path.join(__dirname, '../dossiers.json');
const LOG_CHANNEL_ID = '1525639883412996116'; 

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log('📊 Server Health Dashboard loop initialized.');

        // Run check every hour to see if it's Sunday midnight
        setInterval(async () => {
            const now = new Date();
            // 0 = Sunday, 0 hours, 0 minutes
            if (now.getDay() === 0 && now.getHours() === 0) {
                const guild = client.guilds.cache.first();
                if (!guild) return;

                const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
                if (!logChannel) return;

                // Fetch database stats
                if (!fs.existsSync(historyFilePath)) return;
                const database = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));

                let totalWarns = 0;
                let activeStaff = {};

                // Loop through records to compile stats
                Object.values(database).forEach(userFile => {
                    if (userFile.warns) totalWarns += userFile.warns.length;
                    
                    // Count how many actions each staff member did this week
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

                // Format leaderboard text
                let staffLeaderboard = Object.entries(activeStaff)
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
            }
        }, 3600000); // Checks every hour (3,600,000 ms)
    },
};
