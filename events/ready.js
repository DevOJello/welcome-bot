const MEMBER_COUNT_CHANNEL_ID = '1524405788347600936';
const VERIFIED_COUNT_CHANNEL_ID = '1524406634871394485';
const VERIFIED_ROLE_ID = '1523972825025745066';

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`🤖 Oscar is online and authenticated as ${client.user.tag}!`);

        // Initialize the status counter loop (runs every 10 minutes)
        // Discord strictly rate-limits channel name changes, so do not set this interval lower!
        setInterval(async () => {
            const guild = client.guilds.cache.first(); // Grabs your main server
            if (!guild) return;

            try {
                // Fetch members to guarantee cached roles and counts are accurate
                await guild.members.fetch();

                const totalMembers = guild.memberCount;
                const verifiedMembers = guild.roles.cache.get(VERIFIED_ROLE_ID)?.members.size || 0;

                const memberChannel = guild.channels.cache.get(MEMBER_COUNT_CHANNEL_ID);
                const verifiedChannel = guild.channels.cache.get(VERIFIED_COUNT_CHANNEL_ID);

                if (memberChannel) {
                    await memberChannel.setName(`👥 Total Members: ${totalMembers}`);
                }

                if (verifiedChannel) {
                    await verifiedChannel.setName(`🛡️ Verified: ${verifiedMembers}`);
                }

                console.log('📊 Server counter channels updated successfully.');

            } catch (error) {
                console.error('Failed to update status counter channels:', error);
            }
        }, 600000); // 600,000 ms = 10 minutes
    },
};
