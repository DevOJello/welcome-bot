const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Global in-memory storage for active games
const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hangrygames')
    .setDescription('Play Oscars Hangry Games!')
    .addSubcommand(sub =>
      sub.setName('new')
        .setDescription('Start a new round of Hangry Games')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of this round (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('giveaway')
        .setDescription('Start a Hangry Games giveaway with a custom prize')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this giveaway').setRequired(true))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of the prize'))
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Immediately start a Hangry Games with everyone in a specific role')
        .addRoleOption(opt => opt.setName('role').setDescription('The role to pull players from').setRequired(true))
        .addStringOption(opt => opt.setName('prize').setDescription('The prize for this round (optional)'))
        .addUserOption(opt => opt.setName('sponsor').setDescription('Sponsor of this round (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the current active Hangry Games on this server')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

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

    if (activeGames.has(guildId)) {
      return interaction.reply({ content: '❌ A Hangry Games session is already active on this server!', flags: 64 });
    }

    const prize = interaction.options.getString('prize') || 'Eternal Glory 🏆';
    const sponsor = interaction.options.getUser('sponsor');

    if (sub === 'role') {
      const role = interaction.options.getRole('role');
      await interaction.deferReply();

      try { await interaction.guild.members.fetch(); } catch (err) { console.error(err); }
      const membersWithRole = role.members.filter(member => !member.user.bot);

      if (membersWithRole.size < 2) {
        return interaction.editReply({ content: `❌ You need at least **2 human players** with the <@&${role.id}> role!` });
      }

      const game = {
        hostId: interaction.user.id,
        prize: prize,
        sponsorId: sponsor ? sponsor.id : null,
        players: new Set(membersWithRole.map(member => member.id)),
        status: 'playing'
      };

      activeGames.set(guildId, game);
      await interaction.editReply({ content: `⚔️ **Instant Match Triggered!** Grabbing everyone with the <@&${role.id}> role...` });
      return module.exports.runGameSimulation(interaction, game);
    }

    if (sub === 'new' || sub === 'giveaway') {
      activeGames.set(guildId, {
        hostId: interaction.user.id,
        prize: prize,
        sponsorId: sponsor ? sponsor.id : null,
        players: new Set(),
        status: 'lobby'
      });

      const lobbyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hg_join_${guildId}`).setLabel('Join').setEmoji('🍔').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`hg_tributes_${guildId}`).setLabel('Tributes').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`hg_start_${guildId}`).setLabel('Start Game').setEmoji('🍴').setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setTitle(`🍔 Oscar's Hangry Games 🍔`)
        .setColor(0xFEE75C)
        .setDescription(`**Phase 1 - Gathering Tributes!**\n\nClick **Join** 🍔 to enter the arena!\n\n⚔️ **0 tributes have volunteered so far.**`)
        .addFields(
          { name: '🎁 Prize', value: prize, inline: true },
          { name: '📣 Sponsor', value: sponsor ? `<@${sponsor.id}>` : `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: 'Only the host or administrators can click Start.' });

      await interaction.reply({ embeds: [embed], components: [lobbyRow] });
    }
  },

  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guildId;
    const game = activeGames.get(guildId);

    if (!game) return interaction.reply({ content: '❌ This session has already expired or been cancelled.', flags: 64 });

    if (customId === `hg_join_${guildId}`) {
      const userId = interaction.user.id;
      if (game.players.has(userId)) {
        game.players.delete(userId);
        await interaction.reply({ content: '🏃‍♂️ You backed out of the Hangry Games.', flags: 64 });
      } else {
        game.players.add(userId);
        await interaction.reply({ content: '🍔 You have volunteered! Good luck!', flags: 64 });
      }

      const count = game.players.size;
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(`**Phase 1 - Gathering Tributes!**\n\nClick **Join** 🍔 to enter the arena!\n\n⚔️ **${count} ${count === 1 ? 'tribute has' : 'tributes have'} volunteered so far.**`);
      await interaction.message.edit({ embeds: [updatedEmbed] });
    }

    if (customId === `hg_tributes_${guildId}`) {
      if (game.players.size === 0) return interaction.reply({ content: 'There are no tributes registered yet!', flags: 64 });
      const playerMentions = Array.from(game.players).map(id => `<@${id}>`).join('\n');
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚔️ Registered Tributes').setColor(0x5865F2).setDescription(playerMentions)], flags: 64 });
    }

    if (customId === `hg_start_${guildId}`) {
      if (interaction.user.id !== game.hostId && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '⚠️ Only the host or staff members can begin.', flags: 64 });
      }
      if (game.players.size < 2) return interaction.reply({ content: '❌ You need at least **2 tributes** to start!', flags: 64 });

      game.status = 'playing';
      await interaction.update({ content: '⚙️ *Starting engines... Preparing a pure carnage match...*', embeds: [], components: [] });
      module.exports.runGameSimulation(interaction, game);
    }
  },

  async runGameSimulation(interaction, game) {
    const channel = interaction.channel;
    const guildId = interaction.guildId;
    let survivors = Array.from(game.players);
    let round = 1;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- EVENTS POOL (ELK EVENT IS DODELIJK) ---
    const soloDeaths = [
      "**{player1}** choked on an incredibly dry cracker! 🥖", "**{player1}** slipped on a huge glob of mayonnaise and tumbled into the abyss! 🍟",
      "**{player1}** couldn't survive a radioactive pickle explosion! 🥒", "**{player1}** got a massive energy drink sugar rush and ran head-first out of bounds! ⚡",
      "**{player1}** got covered in exploding hot sauce and dissolved! 🌶️", "**{player1}** got trapped inside a sticky cotton candy machine forever! 🍭",
      "**{player1}** mistook a powerful blender for a jacuzzi and got shredded! 🌀", "**{player1}** got tangled up and suffocated in molten mozzarella pizza cheese! 🍕",
      "**{player1}** crashed terribly trying to ride a giant rolling donut! 🍩", "**{player1}** turned entirely into carbonated bubbles and floated away into deep space! 🫧",
      "**{player1}** got sucked into a massive vending machine vortex! 🪙", "**{player1}** melted right through the floor eating boiling lava-soup! 🥣",
      "**{player1}** was brutally chased out of the arena by a rogue sentient gingerbread man! 🫚", "**{player1}** ate a mystery mushroom and exploded into stardust! 🍄",
      "**{player1}** got buried completely under an avalanche of popcorn! 🍿", "**{player1}** double-dipped a chip and was vaporized by the Food Police! 👮‍♂️",
      "**{player1}** shattered reality biting a rock-hard jawbreaker and vanished! 🍬", "**{player1}** got folded into a giant taco shell and shipped off the map! 🌮",
      "**{player1}** tried to drink boiling caramel and solidified into a lifeless statue! 🍯", "**{player1}** opened a cursed fortune cookie that deleted them from existence! 🥠",
      "**{player1}** was crushed flat by a rogue, giant flying pancake! 🥞", "**{player1}** sniffed pepper and sneezed themselves directly into orbit! 🧂",
      "**{player1}** fell into a deep boiling chocolate fountain and never surfaced! 🍫", "**{player1}** got locked in an industrial freezer and turned into a permanent ice lolly! ❄️",
      "**{player1}** tried to slice an onion but cried so hard they drowned in their own tears! 🧅"
    ];

    const combatEvents = [
      "**{player1}** turned **{player2}** into a green bean casserole! 🍲", "**{player1}** blasted **{player2}** away with a blazing hot slice of pizza! 🍕",
      "**{player1}** stole **{player2}**'s legendary golden fry and executed them! 🍟", "**{player1}** knocked out **{player2}** permanently using a stale baguette! 🥖",
      "**{player1}** made **{player2}** slide off the map into the void with slippery maple syrup! 🥞", "**{player1}** pelted **{player2}** with rock-hard meatballs until they collapsed! 🧆",
      "**{player1}** trapped **{player2}** inside a giant waffle iron and closed the lid! 🧇", "**{player1}** blinded **{player2}** with a mountain of whipped cream, sending them over the edge! 🧁",
      "**{player1}** defeated **{player2}** in a brutal, fatal spicy chicken wing showdown! 🍗", "**{player1}** used a high-pressure mustard bottle to launch **{player2}** into a brick wall! 🌭",
      "**{player1}** encased **{player2}** inside a massive solid block of gelatin! 🍮", "**{player1}** rolled a heavy jawbreaker down a ramp, flattening **{player2}**! 🔴",
      "**{player1}** over-seasoned **{player2}**'s meal, causing a fatal sneezing fit out of bounds! 🫙", "**{player1}** used a giant fork to catapult **{player2}** straight into orbit! 🍴",
      "**{player1}** hypnotized **{player2}** with a swirling Cinnabon and led them off a fatal ledge! 🌀", "**{player1}** unleashed hungry flesh-eating mice to strip **{player2}**, forcing an elimination! 🧀",
      "**{player1}** trapped **{player2}** inside a giant toaster set to extra crispy! 🍞", "**{player1}** popped a giant bubblegum bubble, blowing **{player2}** entirely out of the arena! 🫧",
      "**{player1}** knocked **{player2}** out cold with a heavy cast-iron skillet! 🍳", "**{player1}** choked **{player2}** out using a giant lasso of string cheese! 🫕",
      "**{player1}** hit **{player2}** with a critical, fatal strike from a frozen fish fillet! 🐟", "**{player1}** threw a spiked pineapple directly at **{player2}**, eliminating them! 🍍",
      "**{player1}** locked **{player2}** inside a dark pantry and swallowed the key forever! 🗝️", "**{player1}** used an oversized pepper grinder to completely dust and suffocate **{player2}**! 🌶️",
      "**{player1}** forced **{player2}** to eat a raw radioactive lemon, causing them to shrivel up and vanish! 🍋"
    ];

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🏁 The Hangry Games Have Begun!')
        .setColor(0xED4245)
        .setDescription(`**${survivors.length} tributes** step up to the dining table. There is no escaping... every event will take a life! 🪓`)
      ]
    });
    await sleep(4000);

    // Blijf loopen tot er exact 1 overlevende is
    while (survivors.length > 1) {
      if (!activeGames.has(guildId)) return;

      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle(`🥞 Round ${round} 🥞`)
          .setColor(0xFEE75C)
          .setDescription(`*The arena shrinks... No one is safe. Remaining tributes: ${survivors.length}*`)
        ]
      });
      await sleep(2500);

      const deadThisRound = new Set();
      let pool = [...survivors];
      
      // Schud de actieve spelers van deze ronde door elkaar
      pool.sort(() => Math.random() - 0.5);

      while (pool.length > 0) {
        if (!activeGames.has(guildId)) return;

        // Als er nog maar 1 speler over is in deze ronde-loop én er zijn in totaal nog andere overlevers, 
        // dan moet deze speler helaas ook een dodelijk solo-event krijgen om te voldoen aan "altijd iemand dood"
        if (pool.length === 1) {
          const player = pool.pop();
          
          // Alleen doden als deze speler niet toevallig de allerlaatste speler op de hele server is
          if (survivors.length - deadThisRound.size > 1) {
            let embed = new EmbedBuilder().setColor(0xE74C3C);
            const eventText = soloDeaths[Math.floor(Math.random() * soloDeaths.length)].replace(/{player1}/g, `<@${player}>`);
            deadThisRound.add(player);

            try {
              const user = await interaction.client.users.fetch(player);
              embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
            } catch (err) { console.error(err); }

            embed.setDescription(eventText);
            await channel.send({ embeds: [embed] });
            await sleep(3500);
          }
          break;
        }

        // Pak twee spelers uit de pool
        const player1 = pool.pop();
        const player2 = pool.pop();

        let embed = new EmbedBuilder().setColor(0xE74C3C);
        let eventText = "";

        // 50/50 kans: of een gevecht waarbij Player 2 sterft, of een solo-ongeluk waarbij Player 1 sterft
        if (Math.random() < 0.5) {
          eventText = combatEvents[Math.floor(Math.random() * combatEvents.length)]
            .replace(/{player1}/g, `<@${player1}>`).replace(/{player2}/g, `<@${player2}>`);
          deadThisRound.add(player2);
          
          try {
            const user = await interaction.client.users.fetch(player1);
            embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
          } catch (err) { console.error(err); }
        } else {
          eventText = soloDeaths[Math.floor(Math.random() * soloDeaths.length)].replace(/{player1}/g, `<@${player1}>`);
          deadThisRound.add(player1);

          try {
            const user = await interaction.client.users.fetch(player1);
            embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
          } catch (err) { console.error(err); }
        }

        embed.setDescription(eventText);
        await channel.send({ embeds: [embed] });
        await sleep(3500);
      }

      // Pas de overlevendenlijst direct aan
      survivors = survivors.filter(id => !deadThisRound.has(id));

      // Ultieme fail-safe: als iedereen onverhoopt tegelijk stierf, kies willekeurig 1 winnaar uit de startlijst
      if (survivors.length === 0) {
        survivors = [Array.from(game.players)[Math.floor(Math.random() * game.players.size)]];
      }
      round++;
    }

    if (!activeGames.has(guildId)) return;

    // --- WINNAAR AANKONDIGING ---
    const winnerId = survivors[0];
    const sponsorText = game.sponsorId ? `<@${game.sponsorId}>` : `<@${game.hostId}>`;
    let winnerEmbed = new EmbedBuilder()
      .setTitle('👑 We have a survivor! 👑')
      .setColor(0x57F287)
      .setDescription(`🏆 **CONGRATULATIONS <@${winnerId}>!** 🏆\n\nYou are the last one standing after an absolute bloodbath!\n\n🎁 **Prize:** ${game.prize}\n📣 **Sponsor:** ${sponsorText}`)
      .setFooter({ text: "Thanks for playing Oscar's Pure Carnage Hangry Games!" });

    try {
      const winnerUser = await interaction.client.users.fetch(winnerId);
      winnerEmbed.setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 512 }));
    } catch (err) { console.error(err); }

    await channel.send({ content: `🎉 Congratulations <@${winnerId}>!`, embeds: [winnerEmbed] });
    activeGames.delete(guildId);
  }
};
