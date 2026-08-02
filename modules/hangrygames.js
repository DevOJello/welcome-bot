const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const activeGames = new Map();

const soloTemplatePath = path.join(__dirname, '../images/burger_solo.png');
const vsTemplatePath = path.join(__dirname, '../images/burger_vs.png');
const skullPath = path.join(__dirname, '../images/skull.png');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hangrygames')
    .setDescription("Start a round of Oscar's Hangry Games!")
    .addSubcommand(sub =>
      sub.setName('new')
        .setDescription('Create a new Hangry Games lobby')
        .addStringOption(opt => opt.setName('prize').setDescription('Prize for this round (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the active Hangry Games session')
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Host a Hangry Games for members with a specific role')
        .addStringOption(opt =>
          opt.setName('role')
            .setDescription('Role to host the game for')
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'new') {
      // Create a new game
      const prize = interaction.options.getString('prize') || 'No prize';
      const gameId = interaction.id; // Using interaction ID as game ID
      const game = {
        id: gameId,
        hostId: interaction.user.id,
        prize: prize,
        players: [interaction.user],
        started: false,
      };
      activeGames.set(gameId, game);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`hangry_join_${gameId}`)
            .setLabel('Join')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`hangry_start_${gameId}`)
            .setLabel('Start Game')
            .setStyle(ButtonStyle.Success),
        );

      await interaction.reply({ content: `New Hangry Games lobby created by ${interaction.user}. Prize: ${prize}`, components: [row] });
    } else if (sub === 'cancel') {
      // Cancel game
      const gameId = interaction.message?.interaction?.id || interaction.message.id;
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        await interaction.reply('The Hangry Games session has been canceled.');
      } else {
        await interaction.reply('No active game found.');
      }
    } else if (sub === 'role') {
      const roleName = interaction.options.getString('role');
      await interaction.reply(`Hosting a Hangry Games for all members with role ${roleName}...`);
      // Additional logic can be added here to filter members by role and start game
    }
  },

  async handleButton(interaction, client) {
    const [action, gameId] = interaction.customId.split('_').slice(1);

    if (!activeGames.has(gameId)) {
      await interaction.reply({ content: 'This game no longer exists.', ephemeral: true });
      return;
    }

    const game = activeGames.get(gameId);

    if (action === 'join') {
      if (!game.players.find(p => p.id === interaction.user.id)) {
        game.players.push(interaction.user);
        await interaction.reply({ content: `${interaction.user} has joined the game!`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'You are already in the game!', ephemeral: true });
      }
    } else if (action === 'start') {
      if (interaction.user.id !== game.hostId) {
        await interaction.reply({ content: 'Only the host can start the game!', ephemeral: true });
        return;
      }
      if (game.players.length < 2) {
        await interaction.reply({ content: 'Not enough players to start.', ephemeral: true });
        return;
      }

      game.started = true;
      await this.runGame(interaction, game);
      activeGames.delete(gameId);
    }
  },

  async runGame(interaction, game) {
    // Generate images for each player
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      const canvas = createCanvas(600, 400);
      const ctx = canvas.getContext('2d');

      const templatePath = game.players.length === 1 ? soloTemplatePath : vsTemplatePath;
      const template = await loadImage(templatePath);
      ctx.drawImage(template, 0, 0, 600, 400);

      // Add player name text
      ctx.font = '30px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(player.username, 50, 50);

      // Save image buffer
      const buffer = canvas.toBuffer('image/png');
      const attachment = new AttachmentBuilder(buffer, { name: `player_${player.id}.png` });

      await interaction.channel.send({ files: [attachment] });
    }

    // Randomly select a winner
    const winnerIndex = Math.floor(Math.random() * game.players.length);
    const winner = game.players[winnerIndex];

    await interaction.channel.send(`🎉 The winner is: ${winner.username}! 🎉`);
  },
};