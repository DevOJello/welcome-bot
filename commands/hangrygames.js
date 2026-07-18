const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// In-memory storage for active games per guild
const activeGames = new Map();

// File paths to your assets
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
      const role = interaction.options.getRole('targetrole');
      const members = role.members.filter(member => !member.user.bot);
      
      if (members.size < 2) {
        return interaction.reply({ content: `❌ There are not enough members (minimum 2) with the role ${role} to start a game!`, flags: 64 });
      }

      members.forEach(member => startingPlayers.add(member.id));
      isInstantStart = true;
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
      await interaction.reply({ content: `🎬 Direct start! Gathering everyone with the role... Let the battle begin!`, embeds: [], components: [] });
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
      const canvas = createCanvas(1000, 1000);
      const ctx = canvas.getContext('2d');
      if (fs.existsSync(soloTemplatePath)) ctx.drawImage(await loadImage(soloTemplatePath), 0, 0, 1000, 1000);
      try { ctx.drawImage(await loadImage(avatarUrl), 268, 290, 465, 465); } catch(e){}
      return canvas.toBuffer('image/png');
    }

    async function drawVs(winUrl, loseUrl) {
      const canvas = createCanvas(1000, 600);
      const ctx = canvas.getContext('2d');
      if (fs.existsSync(vsTemplatePath)) ctx.drawImage(await loadImage(vsTemplatePath), 0, 0, 1000, 600);
      try { ctx.drawImage(await loadImage(winUrl), 80, 100, 320, 320); } catch(e){}
      try {
        ctx.drawImage(await loadImage(loseUrl), 600, 100, 320, 320);
        if (fs.existsSync(skullPath)) ctx.drawImage(await loadImage(skullPath), 0, 0, 1000, 600);
      } catch(e){}
      return canvas.toBuffer('image/png');
    }

    const soloDeaths = [
      "**{player1}** went to take a relaxing shower, but a rogue rubber duck bit their leg, causing them to trip and drown in the tub! 🦆🛁",
      "**{player1}** choked on an incredibly dry cracker because they forgot to drink water! 🥖",
      "**{player1}** slipped on a huge glob of mayonnaise and tumbled straight out of the arena! 🍟",
      "**{player1}** took a massive bite out of a radioactive pickle and couldn't survive the flavor explosion! 🥒",
      "**{player1}** got a massive sugar rush from an energy drink and ran head-first out of bounds! ⚡",
      "**{player1}** tried to open a stubborn jar of hot sauce, but it exploded right in their face! 🌶️",
      "**{player1}** got trapped inside a giant, sticky cotton candy machine and couldn't break free! 🍭",
      "**{player1}** mistook a super-powerful blender for a jacuzzi and got spun out of the game! 🌀",
      "**{player1}** ate a slice of pizza that was way too cheesy and got completely tangled up in mozzarella! 🍕",
      "**{player1}** tried to ride a giant rolling donut like a wheel, but lost balance and crashed hard! 🍩",
      "**{player1}** accidentally drank an experimental soda that turned them entirely into carbonated bubbles! 🫧",
      "**{player1}** reached for a snack but got sucked into a massive vending machine vortex! 🪙",
      "**{player1}** tried to eat a soup that was way too hot and melted right through the arena floor! 🥣",
      "**{player1}** got chased out of the arena by a rogue, sentient gingerbread man! 🫚",
      "**{player1}** ate a mystery mushroom and floated away into outer space like a balloon! 🍄",
      "**{player1}** accidentally tripped a trap and got buried under a massive avalanche of popcorn! 🍿",
      "**{player1}** tried to double-dip a chip and was immediately blasted away by the Food Police! 👮‍♂️",
      "**{player1}** bit into a jawbreaker that was so hard it shattered the space-time continuum, removing them from reality! 🍬",
      "**{player1}** tried to sleep inside a giant taco shell, but got folded up and shipped away! 🌮"
    ];

    const combatEvents = [
      "**{player1}** chopped **{player2}** into small pieces and turned them into a green bean casserole! 🍲",
      "**{player1}** threw a blazing hot slice of pizza directly at **{player2}**, forcing them out of the game! 🍕",
      "**{player1}** stole **{player2}**'s legendary golden french fry and eliminated them on the spot! 🍟",
      "**{player1}** knocked out **{player2}** cold using a rock-hard, stale baguette! 🥖",
      "**{player1}** covered the floor in slippery maple syrup, causing **{player2}** to slide right off the map! 🥞",
      "**{player1}** aggressively pelted **{player2}** with stale meatballs until they surrendered! 🧆",
      "**{player1}** trapped **{player2}** inside a giant waffle iron and pressed down the lid! 🧇",
      "**{player1}** sprayed a mountain of whipped cream into **{player2}**'s eyes, blinding them into a pit! 🧁",
      "**{player1}** challenged **{player2}** to a spicy chicken wing showdown, and **{player2}** couldn't take the heat! 🍗",
      "**{player1}** used a high-pressure mustard bottle to blast **{player2}** straight out of the arena! 🌭",
      "**{player1}** trapped **{player2}** inside a massive block of gelatin, leaving them completely stuck! 🍮",
      "**{player1}** rolled a giant, heavy jawbreaker down a ramp, flattening **{player2}** instantly! 🔴",
      "**{player1}** over-seasoned **{player2}**'s meal, causing them to sneeze so hard they flew out of bounds! 🫙",
      "**{player1}** used a giant fork like a catapult to launch **{player2}** into orbit! 🍴",
      "**{player1}** hypnotized **{player2}** with a perfectly glazed, swirling Cinnabon and led them off a ledge! 🌀",
      "**{player1}** unleased a swarm of hungry cartoon mice to steal all of **{player2}**'s armor, forcing a retreat! 🧀",
      "**{player1}** trapped **{player2}** inside a giant toaster and set it to 'Extra Crispy'! 🍞",
      "**{player1}** popped a giant bubblegum bubble right next to **{player2}**, blowing them completely away! 🫧"
    ];

    while (survivors.length > 1) {
      if (!activeGames.has(guildId)) return;

      const roundEmbed = new EmbedBuilder()
        .setTitle(`🥞 Round ${round} 🥞`)
        .setColor(0x3498DB)
        .setDescription(`**${survivors.length} tributes remaining** inside the arena...`);
      await channel.send({ embeds: [roundEmbed] });
      await sleep(4000);

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
        } catch(e){}

        let embed = new EmbedBuilder().setColor(0xE74C3C);
        let buffer = null;

        if (Math.random() < 0.5) {
          embed.setDescription(combatEvents[Math.floor(Math.random() * combatEvents.length)]
            .replace(/{player1}/g, `<@${player2}>`).replace(/{player2}/g, `<@${player1}>`));
          
          deadThisRound.add(player1);
          game.kills.set(player2, (game.kills.get(player2) || 0) + 1);
          pool.push(player2);

          if (p2Av && p1Av) buffer = await drawVs(p2Av, p1Av);
        } else {
          embed.setDescription(soloDeaths[Math.floor(Math.random() * soloDeaths.length)]
            .replace(/{player1}/g, `<@${player1}>`));
          
          deadThisRound.add(player1);
          pool.push(player2);

          if (p1Av) buffer = await drawSolo(p1Av);
        }

        const msgOptions = { embeds: [embed] };
        if (buffer) {
          const att = new AttachmentBuilder(buffer, { name: 'event.png' });
          embed.setImage('attachment://event.png');
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

    const endEmbed = new EmbedBuilder()
      .setTitle('👑 WE HAVE A WINNER! 👑')
      .setColor(0xFEE75C)
      .setDescription(`🏆 **Congratulations <@${victor}>!** 🏆\n\nYou outlasted everyone and survived the arena!\n\n💀 Kills: **${kills}**\n🎁 Prize: **${game.prize}**`);

    try {
      const u = await client.users.fetch(victor);
      const buf = await drawSolo(u.displayAvatarURL({ extension: 'png', size: 256 }));
      const att = new AttachmentBuilder(buf, { name: 'victory.png' });
      endEmbed.setImage('attachment://victory.png');
      await channel.send({ content: `🎉 Celebration time <@${victor}>!`, embeds: [endEmbed], files: [att] });
    } catch(e) {
      await channel.send({ content: `🎉 Celebration time <@${victor}>!`, embeds: [endEmbed] });
    }

    activeGames.delete(guildId);
  }
};
