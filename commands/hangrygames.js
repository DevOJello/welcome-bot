const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// In-memory storage for active games per guild
const activeGames = new Map();

// Paden op basis van jouw mappenstructuur
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
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the current active Hangry Games session')
    )
    .addSubcommand(sub =>
      sub.setName('giveaway')
        .setDescription('Use giveaway mode with feasts off by default')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for the giveaway').setRequired(true))
        .addStringOption(opt => opt.setName('option1').setDescription('Optional parameter 1'))
        .addStringOption(opt => opt.setName('option2').setDescription('Optional parameter 2'))
        .addStringOption(opt => opt.setName('option3').setDescription('Optional parameter 3'))
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Immediately start a Hangry Games with everyone in a role')
        .addRoleOption(opt => opt.setName('targetrole').setDescription('The role containing the players').setRequired(true))
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'cancel') {
      if (!activeGames.has(guildId)) {
        return interaction.reply({ content: '❌ There is no active Hangry Games session running on this server.', flags: 64 });
      }
      activeGames.delete(guildId);
      return interaction.reply({ content: '🏁 The Hangry Games have been cancelled.' });
    }

    if (activeGames.has(guildId)) {
      return interaction.reply({ content: '❌ A Hangry Games session is already active on this server!', flags: 64 });
    }

    let prize = interaction.options.getString('prize') || 'Eternal Glory 🏆';
    let startingPlayers = new Set();
    let isInstantStart = false;

    if (sub === 'role') {
      await interaction.deferReply();
      const role = interaction.options.getRole('targetrole');
      
      try {
        await interaction.guild.members.fetch();
        const members = role.members.filter(member => !member.user.bot);
        
        if (members.size < 2) {
          return interaction.editReply({ content: `❌ There are not enough members (minimum 2) with the role ${role} to start a game!` });
        }

        members.forEach(member => startingPlayers.add(member.id));
        isInstantStart = true;
      } catch (error) {
        console.error(error);
        return interaction.editReply({ content: '❌ Something went wrong while fetching the members of this role.' });
      }
    }

    const gameData = {
      hostId: interaction.user.id,
      prize: prize,
      players: startingPlayers,
      kills: new Map(),
      status: 'lobby',
      isGiveaway: (sub === 'giveaway')
    };

    if (isInstantStart) {
      startingPlayers.forEach(id => gameData.kills.set(id, 0));
    }

    activeGames.set(guildId, gameData);

    if (isInstantStart) {
      gameData.status = 'playing';
      await interaction.editReply({ content: `🎬 Direct start! Gathering everyone with the role... Let the battle begin!`, embeds: [], components: [] });
      return module.exports.runGameSimulation(interaction, gameData, client);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`hg_join_${guildId}`).setLabel('Join 🍔').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`hg_start_${guildId}`).setLabel('Start 🍴').setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle(sub === 'giveaway' ? `🎁 Oscar's Hangry Games (Giveaway Mode) 🎁` : `🍔 Oscar's Hangry Games 🍔`)
      .setColor(0xFEE75C)
      .setDescription(`Click **Join** 🍔 to enter the arena and fight for survival!\n\n🎁 **Prize:** ${prize}`)
      .setFooter({ text: 'Only the host can start the game.' });

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async handleButton(interaction, client) {
    const guildId = interaction.guildId;
    const game = activeGames.get(guildId);
    if (!game) return interaction.reply({ content: '❌ Game session not found.', flags: 64 });

    if (interaction.customId === `hg_join_${guildId}`) {
      if (game.players.has(interaction.user.id)) {
        game.players.delete(interaction.user.id);
        game.kills.delete(interaction.user.id);
        await interaction.reply({ content: '🏃‍♂️ You backed out of the arena.', flags: 64 });
      } else {
        game.players.add(interaction.user.id);
        game.kills.set(interaction.user.id, 0);
        await interaction.reply({ content: '🍔 You have volunteered as a tribute! Good luck!', flags: 64 });
      }

      const count = game.players.size;
      const originalEmbed = interaction.message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setDescription(`Click **Join** 🍔 to enter the arena and fight for survival!\n\n🎁 **Prize:** ${game.prize}\n\n⚔️ **${count} tributes have volunteered so far.**`);

      await interaction.message.edit({ embeds: [updatedEmbed] });
    }

    if (interaction.customId === `hg_start_${guildId}`) {
      if (interaction.user.id !== game.hostId) {
        return interaction.reply({ content: '⚠️ Only the host who started the lobby can begin the match.', flags: 64 });
      }
      if (game.players.size < 2) {
        return interaction.reply({ content: '❌ You need at least **2 tributes** to start the Hangry Games!', flags: 64 });
      }

      game.status = 'playing';
      await interaction.update({ content: '🎬 The tributes enter the arena... Let the battle begin!', embeds: [], components: [] });
      
      return module.exports.runGameSimulation(interaction, game, client);
    }
  },

  async runGameSimulation(interaction, game, client) {
    const channel = interaction.channel;
    const guildId = interaction.guildId;
    let survivors = Array.from(game.players);
    let round = 1;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function drawSolo(avatarUrl) {
      try {
        const canvas = createCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        
        if (fs.existsSync(soloTemplatePath)) {
          ctx.drawImage(await loadImage(soloTemplatePath), 0, 0, 1000, 1000);
        } else {
          console.error(`[CANVAS FOUT] burger_solo.png niet gevonden op pad: ${soloTemplatePath}`);
        }
        
        if (avatarUrl) {
          const avImg = await loadImage(avatarUrl);
          ctx.drawImage(avImg, 268, 290, 465, 465);
        }
        return canvas.toBuffer('image/png');
      } catch (err) {
        console.error('[CANVAS CRASH drawSolo]:', err);
        return null;
      }
    }

    async function drawVs(winUrl, loseUrl) {
      try {
        const canvas = createCanvas(1000, 600);
        const ctx = canvas.getContext('2d');
        
        if (fs.existsSync(vsTemplatePath)) {
          ctx.drawImage(await loadImage(vsTemplatePath), 0, 0, 1000, 600);
        } else {
          console.error(`[CANVAS FOUT] burger_vs.png niet gevonden op pad: ${vsTemplatePath}`);
        }
        
        if (winUrl) ctx.drawImage(await loadImage(winUrl), 80, 100, 320, 320);
        if (loseUrl) ctx.drawImage(await loadImage(loseUrl), 600, 100, 320, 320);
        
        if (fs.existsSync(skullPath)) {
          ctx.drawImage(await loadImage(skullPath), 0, 0, 1000, 600);
        }
        
        return canvas.toBuffer('image/png');
      } catch (err) {
        console.error('[CANVAS CRASH drawVs]:', err);
        return null;
      }
    }

    const soloDeaths = [
      "**{player1}** went to take a relaxing shower, but a rogue rubber duck bit their leg, causing them to trip and drown in the tub! 🦆🛁",
      "**{player1}** choked on an incredibly dry cracker because they forgot to drink water! 🥖",
      "**{player1}** slipped on a huge glob of mayonnaise and tumbled straight out of the arena! 🍟",
      "**{player1}** took a massive bite out of a radioactive pickle and couldn't survive the flavor explosion! 🥒"
    ];

    const combatEvents = [
      "**{player1}** chopped **{player2}** into small pieces and turned them into a green bean casserole! 🍲",
      "**{player1}** threw a blazing hot slice of pizza directly at **{player2}**, forcing them out of the game! 🍕",
      "**{player1}** stole **{player2}**'s legendary golden french fry and eliminated them on the spot! 🍟",
      "**{player1}** knocked out **{player2}** cold using a rock-hard, stale baguette! 🥖"
    ];

    while (survivors.length > 1) {
      if (!activeGames.has(guildId)) return;

      let pool = [...survivors].sort(() => Math.random() - 0.5);
      const deadThisRound = new Set();

      while (pool.length > 1) {
        if (!activeGames.has(guildId)) return;

        const player1 = pool.pop();
        const player2 = pool.pop();

        if (deadThisRound.has(player1) || deadThisRound.has(player2)) {
          if (!deadThisRound.has(player1)) pool.push(player1);
          if (!deadThisRound.has(player2)) pool.push(player2);
          continue;
        }

        let p1Av = "", p2Av = "";
        try {
          const u1 = await client.users.fetch(player1);
          const u2 = await client.users.fetch(player2);
          p1Av = u1.displayAvatarURL({ extension: 'png', size: 256 });
          p2Av = u2.displayAvatarURL({ extension: 'png', size: 256 });
        } catch(e){
          console.error('[USER FETCH FOUT]: Kon avatars niet ophalen', e);
        }

        let eventText = "";
        let buffer = null;

        if (Math.random() < 0.5) {
          eventText = combatEvents[Math.floor(Math.random() * combatEvents.length)]
            .replace(/{player1}/g, `<@${player2}>`).replace(/{player2}/g, `<@${player1}>`);
          
          deadThisRound.add(player1);
          game.kills.set(player2, (game.kills.get(player2) || 0) + 1);
          pool.push(player2);

          buffer = await drawVs(p2Av, p1Av);
        } else {
          eventText = soloDeaths[Math.floor(Math.random() * soloDeaths.length)]
            .replace(/{player1}/g, `<@${player1}>`);
          
          deadThisRound.add(player1);
          pool.push(player2);

          buffer = await drawSolo(p1Av);
        }

        const embedEvent = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription(eventText);

        const msgOptions = { embeds: [embedEvent] };

        if (buffer) {
          const att = new AttachmentBuilder(buffer, { name: 'event.png' });
          embedEvent.setImage('attachment://event.png');
          msgOptions.files = [att];
        }

        await channel.send(msgOptions);
        await sleep(4500);
      }

      survivors = survivors.filter(id => !deadThisRound.has(id));
      round++;
    }

    if (!activeGames.has(guildId)) return;

    const victor = survivors[0];
    const kills = game.kills.get(victor) || 0;

    const endText = `🏆 **Congratulations <@${victor}>!** 🏆\n\nYou outlasted everyone and survived the arena!\n\n💀 Kills: **${kills}**\n🎁 Prize: **${game.prize}**`;

    const embedWinner = new EmbedBuilder()
      .setTitle(`👑 WE HAVE A WINNER! 👑`)
      .setColor(0x2ECC71)
      .setDescription(endText);

    try {
      const u = await client.users.fetch(victor);
      const buf = await drawSolo(u.displayAvatarURL({ extension: 'png', size: 256 }));
      if (buf) {
        const att = new AttachmentBuilder(buf, { name: 'victory.png' });
        embedWinner.setImage('attachment://victory.png');
        await channel.send({ embeds: [embedWinner], files: [att] });
      } else {
        await channel.send({ embeds: [embedWinner] });
      }
    } catch(e) {
      await channel.send({ embeds: [embedWinner] });
    }

    activeGames.delete(guildId);
  }
};
