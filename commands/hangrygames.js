const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Global in-memory storage for active games
const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hangrygames')
    .setDescription('Play the ultimate Hangry Games battle royale minigame!')
    
    // 1. /hangrygames new
    .addSubcommand(sub =>
      sub.setName('new')
        .setDescription('Start a new round of Hangry Games')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of this round (optional)'))
    )
    
    // 2. /hangrygames giveaway
    .addSubcommand(sub =>
      sub.setName('giveaway')
        .setDescription('Start a Hangry Games giveaway with a custom prize')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this giveaway').setRequired(true))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of the prize'))
    )
    
    // 3. /hangrygames role
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Immediately start a Hangry Games with everyone in a specific role')
        .addRoleOption(opt => opt.setName('role').setDescription('The role to pull players from').setRequired(true))
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of this round (optional)'))
    )
    
    // 4. /hangrygames cancel
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the current active Hangry Games on this server')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── CANCEL COMMAND ──────────────────────────────────────────────────────
    if (sub === 'cancel') {
      if (!activeGames.has(guildId)) {
        return interaction.reply({ content: '❌ There is no active Hangry Games session running on this server.', flags: 64 });
      }

      activeGames.delete(guildId);
      return interaction.reply({ 
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ **Hangry Games Cancelled!**\n\nThe session has been stopped by <@${interaction.user.id}>.`)
        ] 
      });
    }

    // Check if a game is already active
    if (activeGames.has(guildId)) {
      return interaction.reply({ content: '❌ A Hangry Games session is already active on this server!', flags: 64 });
    }

    const prize = interaction.options.getString('prize') || 'Eternal Glory 🏆';
    const sponsor = interaction.options.getUser('sponsor');

    // ── ROLE COMMAND (INSTANT START) ────────────────────────────────────────
    if (sub === 'role') {
      const role = interaction.options.getRole('role');

      await interaction.deferReply();

      try {
        await interaction.guild.members.fetch();
      } catch (err) {
        console.error('Failed to fetch guild members:', err);
      }

      const membersWithRole = role.members.filter(member => !member.user.bot);

      if (membersWithRole.size < 2) {
        return interaction.editReply({ 
          content: `❌ You need at least **2 human players** with the <@&${role.id}> role to start the Hangry Games!` 
        });
      }

      const game = {
        hostId: interaction.user.id,
        prize: prize,
        sponsorId: sponsor ? sponsor.id : null,
        players: new Set(membersWithRole.map(member => member.id)),
        status: 'playing'
      };

      activeGames.set(guildId, game);

      await interaction.editReply({
        content: `⚔️ **Instant Match Triggered!**\nGrabbing everyone with the <@&${role.id}> role (${membersWithRole.size} players)...`
      });

      return module.exports.runGameSimulation(interaction, game);
    }

    // ── STANDARD SETUP (new & giveaway) ────────────────────────────────────
    if (sub === 'new' || sub === 'giveaway') {
      activeGames.set(guildId, {
        hostId: interaction.user.id,
        prize: prize,
        sponsorId: sponsor ? sponsor.id : null,
        players: new Set(),
        status: 'lobby'
      });

      const lobbyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hg_join_${guildId}`)
          .setLabel('Join')
          .setEmoji('🍔')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`hg_tributes_${guildId}`)
          .setLabel('Tributes')
          .setEmoji('⚔️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`hg_start_${guildId}`)
          .setLabel('Start Game')
          .setEmoji('🍴')
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`🍔 Oscar's Hangry Games 🍔`)
        .setColor(0xFEE75C)
        .setDescription(`**Phase 1 - Gathering Tributes!**\n\nClick **Join** 🍔 to enter the arena and fight for survival!\n\n⚔️ **0 tributes have volunteered so far.**`)
        .addFields(
          { name: '🎁 Prize', value: prize, inline: true },
          { name: '📣 Sponsor', value: sponsor ? `<@${sponsor.id}>` : `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: 'Only the host or administrators can click Start.' });

      await interaction.reply({ embeds: [embed], components: [lobbyRow] });
    }
  },

  // ── BUTTON LOGIC ENGINE ──────────────────────────────────────────────────
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guildId;
    const game = activeGames.get(guildId);

    if (!game) {
      return interaction.reply({ content: '❌ This Hangry Games session has already expired or been cancelled.', flags: 64 });
    }

    // BUTTON: JOIN / LEAVE
    if (customId === `hg_join_${guildId}`) {
      const userId = interaction.user.id;

      if (game.players.has(userId)) {
        game.players.delete(userId);
        await interaction.reply({ content: '🏃‍♂️ You backed out of the Hangry Games.', flags: 64 });
      } else {
        game.players.add(userId);
        await interaction.reply({ content: '🍔 You have volunteered for the Hangry Games! Good luck!', flags: 64 });
      }

      const count = game.players.size;
      const tributeStatusText = count === 1 
        ? `⚔️ **1 tribute has volunteered so far.**` 
        : `⚔️ **${count} tributes have volunteered so far.**`;

      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setDescription(`**Phase 1 - Gathering Tributes!**\n\nClick **Join** 🍔 to enter the arena and fight for survival!\n\n${tributeStatusText}`);

      await interaction.message.edit({ embeds: [updatedEmbed] });
    }

    // BUTTON: VIEW TRIBUTES
    if (customId === `hg_tributes_${guildId}`) {
      if (game.players.size === 0) {
        return interaction.reply({ content: 'There are no tributes registered yet. Be the first to join! 🍔', flags: 64 });
      }

      const playerMentions = Array.from(game.players).map(id => `<@${id}>`).join('\n');
      
      const tributesEmbed = new EmbedBuilder()
        .setTitle('⚔️ Registered Tributes')
        .setColor(0x5865F2)
        .setDescription(playerMentions);

      await interaction.reply({ embeds: [tributesEmbed], flags: 64 });
    }

    // BUTTON: START GAME
    if (customId === `hg_start_${guildId}`) {
      const isHost = interaction.user.id === game.hostId;
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);

      if (!isHost && !isStaff) {
        return interaction.reply({ content: '⚠️ Only the host who started the game or staff members can begin the match.', flags: 64 });
      }

      if (game.players.size < 2) {
        return interaction.reply({ content: '❌ You need at least **2 tributes** to start the Hangry Games!', flags: 64 });
      }

      game.status = 'playing';

      await interaction.update({
        content: '⚙️ *Starting engines... Cooking up unique events...*',
        embeds: [],
        components: []
      });

      module.exports.runGameSimulation(interaction, game);
    }
  },

  // ── GAME SIMULATION ENGINE ────────────────────────────────────────────────
  async runGameSimulation(interaction, game) {
    const channel = interaction.channel;
    const guildId = interaction.guildId;
    let survivors = Array.from(game.players);
    let round = 1;

    // Helper to pause execution between round embeds
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ── ORIGINAL, CARTOONISH FOOD-THEMED EVENT DATABASES ────────────────────
    const soloDeaths = [
      "**{player1}** tried to eat a super-spicy experimental chili pepper and spontaneously combusted! 🔥",
      "**{player1}** tripped and fell into a bubbling vat of boiling cheese sauce. Rest in cheddar! 🧀",
      "**{player1}** got an aggressive sugar rush from eating 12 glazed donuts and ran straight into a brick wall.",
      "**{player1}** choked on an incredibly dry cracker because they forgot to drink water.",
      "**{player1}** tried to steal honey from giant mutant bees and got stung out of the arena! 🐝",
      "**{player1}** drank a mysterious glowing soda and slowly dissolved into a puddle of juice.",
      "**{player1}** got crushed by a massive, falling meatball. Mama mia! 🧆"
    ];

    const combatEvents = [
      "**{player1}** slipped on a banana peel left behind by **{player2}** and slid off the edge! 🍌",
      "**{player1}** was knocked out cold by a flying stale baguette thrown with absolute force by **{player2}**! 🥖",
      "**{player1}** was trapped inside a giant, locking waffle iron by **{player2}**.",
      "**{player1}** got pelted to death with hard-boiled eggs by a highly accurate **{player2}**! 🥚",
      "**{player1}** drank a cup of water offered by **{player2}**, completely unaware that it was actually paint thinner.",
      "**{player1}** tried to steal **{player2}**'s legendary golden french fry and paid with their life!"
    ];

    const safeEvents = [
      "**{player1}** and **{player2}** put aside their hunger and shared a giant pizza. Safe for now! 🍕",
      "**{player1}** found a hidden snack cache and recovered some stamina.",
      "**{player1}** hid inside a hollow giant cabbage to avoid getting spotted.",
      "**{player1}** successfully defended their juicebox from an aggressive wild raccoon.",
      "**{player1}** and **{player2}** had an intense staring contest over a cookie, but both survived."
    ];

    // Introductory Announcement
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🏁 The Hangry Games Have Begun!')
        .setColor(0x5865F2)
        .setDescription(`**${survivors.length} tributes** step up to the dining table. Who will feast, and who will get cooked?\n\nLet the game begin!`)
      ]
    });

    await sleep(4000);

    // Round Loop
    while (survivors.length > 1) {
      // Check if the game has been cancelled mid-match
      if (!activeGames.has(guildId)) return;

      const roundEvents = [];
      const deadThisRound = new Set();
      
      // Determine target deaths per round to prevent games from dragging
      let targetDeaths = 1;
      if (survivors.length > 8) targetDeaths = 3;
      else if (survivors.length > 4) targetDeaths = 2;

      // Shuffle survivors
      let pool = [...survivors];
      pool.sort(() => Math.random() - 0.5);

      while (pool.length > 0) {
        if (pool.length === 1) {
          const player = pool.pop();
          const event = safeEvents[Math.floor(Math.random() * safeEvents.length)]
            .replace(/{player1}/g, `<@${player}>`);
          roundEvents.push(event);
          break;
        }

        const player1 = pool.pop();
        const player2 = pool.pop();
        const rand = Math.random();

        if (targetDeaths > deadThisRound.size && rand < 0.45) {
          // ELIMINATION TRIGGERED
          if (Math.random() < 0.5) {
            // Player 2 kills Player 1
            const event = combatEvents[Math.floor(Math.random() * combatEvents.length)]
              .replace(/{player1}/g, `<@${player1}>`)
              .replace(/{player2}/g, `<@${player2}>`);
            roundEvents.push(event);
            deadThisRound.add(player1);
          } else {
            // Solo accident kills Player 1, Player 2 is safe
            const event = soloDeaths[Math.floor(Math.random() * soloDeaths.length)]
              .replace(/{player1}/g, `<@${player1}>`);
            const safeEvent = safeEvents[Math.floor(Math.random() * safeEvents.length)]
              .replace(/{player1}/g, `<@${player2}>`)
              .replace(/{player2}/g, `<@${player1}>`); // fallback

            roundEvents.push(event);
            roundEvents.push(safeEvent);
            deadThisRound.add(player1);
          }
        } else {
          // SAFE EVENT FOR BOTH
          const event = safeEvents[Math.floor(Math.random() * safeEvents.length)]
            .replace(/{player1}/g, `<@${player1}>`)
            .replace(/{player2}/g, `<@${player2}>`);
          roundEvents.push(event);
        }
      }

      // Update the survivors pool
      survivors = survivors.filter(id => !deadThisRound.has(id));

      // Post Round Status
      const roundEmbed = new EmbedBuilder()
        .setTitle(`🥞 Round ${round} 🥞`)
        .setColor(0xFEE75C)
        .setDescription(roundEvents.join('\n\n'))
        .setFooter({ text: `${survivors.length} tributes remaining...` });

      await channel.send({ embeds: [roundEmbed] });
      
      round++;
      await sleep(5000); // 5 seconds wait so players can read the live action
    }

    // Final safety check
    if (!activeGames.has(guildId)) return;

    // ── VICTORY ANNOUNCEMENT ────────────────────────────────────────────────
    const winnerId = survivors[0];
    const sponsorText = game.sponsorId ? `<@${game.sponsorId}>` : `<@${game.hostId}>`;

    const winnerEmbed = new EmbedBuilder()
      .setTitle('👑 HAIL THE VICTOR! 👑')
      .setColor(0x57F287)
      .setDescription(`🏆 **CONGRATULATIONS <@${winnerId}>!** 🏆\n\nYou have outlasted everyone and survived the brutal tables of the Hangry Games!\n\n🎁 **Prize:** ${game.prize}\n📣 **Sponsor:** ${sponsorText}`)
      .setFooter({ text: 'Thanks for playing Oscar\'s Hangry Games!' });

    await channel.send({ content: `🎉 Congratulations <@${winnerId}>!`, embeds: [winnerEmbed] });

    // Clean up memory
    activeGames.delete(guildId);
  }
};
