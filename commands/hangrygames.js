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
    
    // 3. /hangrygames role (NEW - Instantly starts with a role!)
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

      // We defer the reply because fetching members can take a brief second on larger servers
      await interaction.deferReply();

      try {
        // Fetch all guild members to make sure cache is fully updated
        await interaction.guild.members.fetch();
      } catch (err) {
        console.error('Failed to fetch guild members:', err);
      }

      // Filter out bots to only include real players who have the role
      const membersWithRole = role.members.filter(member => !member.user.bot);

      if (membersWithRole.size < 2) {
        return interaction.editReply({ 
          content: `❌ You need at least **2 human players** with the <@&${role.id}> role to start the Hangry Games!` 
        });
      }

      // Setup the playing state immediately
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

      // Jump straight into the simulation!
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
    const tributes = Array.from(game.players);

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🏁 The Hangry Games Have Begun!')
        .setColor(0x5865F2)
        .setDescription(`**${tributes.length} tributes** step up to the table. Who will eat, and who will get cooked?\n\nLet the feast begin!`)
      ]
    });

    // We will build the round-by-round simulation engine next!
  }
};
