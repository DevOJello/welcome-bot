const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Global in-memory storage for active games and coins
const activeGames = new Map();
const userBalances = new Map(); // Stores { userId: balance }

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
      sub.setName('balance')
        .setDescription('Check your current balance of Hangry Coins')
        .addUserOption(opt => opt.setName('user').setDescription('The user whose balance you want to check (optional)'))
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the current active Hangry Games on this server')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'balance') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const balance = userBalances.get(targetUser.id) || 0;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🪙 Hangry Games Vault')
          .setColor(0xFEE75C)
          .setDescription(`<@${targetUser.id}> currently has **${balance} Hangry Coins**! 🪙\n\n*Earn more coins by executing other players in the arena!*`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))]
      });
    }

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
      await interaction.update({ content: '⚙️ *Starting engines... Preparing a match...*', embeds: [], components: [] });
      module.exports.runGameSimulation(interaction, game);
    }
  },

  async runGameSimulation(interaction, game) {
    const channel = interaction.channel;
    const guildId = interaction.guildId;
    let survivors = Array.from(game.players);
    let round = 1;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const COINS_PER_KILL = 150;
    const VOTE_COST = 150;
    const REQUIRED_VOTES_TO_SAVE = 3;

    // --- EVENTS POOL ---
    const soloDeaths = [
      "**{player1}** choked on an incredibly dry cracker! 🥖", 
      "**{player1}** slipped on a huge glob of mayonnaise and tumbled into the abyss! 🍟",
      "**{player1}** couldn't survive a radioactive pickle explosion! 🥒", 
      "**{player1}** got a massive energy drink sugar rush and ran head-first out of bounds! ⚡",
      "**{player1}** got covered in exploding hot sauce and dissolved! 🌶️", 
      "**{player1}** got trapped inside a sticky cotton candy machine forever! 🍭",
      "**{player1}** mistook a powerful blender for a jacuzzi and got shredded! 🌀", 
      "**{player1}** got tangled up and suffocated in molten mozzarella pizza cheese! 🍕",
      "**{player1}** crashed terribly trying to ride a giant rolling donut! 🍩", 
      "**{player1}** turned entirely into carbonated bubbles and floated away into deep space! 🫧",
      "**{player1}** got sucked into a massive vending machine vortex! 🪙", 
      "**{player1}** melted right through the floor eating boiling lava-soup! 🥣",
      "**{player1}** was brutally chased out of the arena by a rogue sentient gingerbread man! 🫚", 
      "**{player1}** ate a mystery mushroom and exploded into stardust! 🍄",
      "**{player1}** got buried completely under an avalanche of popcorn! 🍿", 
      "**{player1}** double-dipped a chip and was vaporized by the Food Police! 👮‍♂️",
      "**{player1}** shattered reality biting a rock-hard jawbreaker and vanished! 🍬", 
      "**{player1}** got folded into a giant taco shell and shipped off the map! 🌮",
      "**{player1}** tried to drink boiling caramel and solidified into a lifeless statue! 🍯", 
      "**{player1}** opened a cursed fortune cookie that deleted them from existence! 🥠",
      "**{player1}** was crushed flat by a rogue, giant flying pancake! 🥞", 
      "**{player1}** sniffed pepper and sneezed themselves directly into orbit! 🧂",
      "**{player1}** fell into a deep boiling chocolate fountain and never surfaced! 🍫", 
      "**{player1}** got locked in an industrial freezer and turned into a permanent ice lolly! ❄️",
      "**{player1}** tried to slice an onion but cried so hard they drowned in their own tears! 🧅",
      "**{player1}** tasted an 'infinite jawbreaker' and suffocated after three hours of continuous chewing! 🔴",
      "**{player1}** tried to drop a Mentos into a 2-liter bottle of soda, and the resulting rocket launch blasted them out of the arena! 🚀",
      "**{player1}** thought a flying pancake was a UFO and got abducted into the culinary cosmos! 🥞",
      "**{player1}** slipped on a puddle of liquid hot grease and slid right off the edge! 🍟",
      "**{player1}** opened a fridge that was so cold they instantly turned into a frozen TV dinner! 🥶",
      "**{player1}** lost a fight against a banana and slipped over the peel straight out of bounds! 🍌",
      "**{player1}** tried to deep-sea dive into a giant bowl of tomato soup without a snorkel! 🥣",
      "**{player1}** ate a 'Ghost Pepper' and flew off the map like a crying human flamethrower! 🌶️",
      "**{player1}** got hypnotized by the fluffy texture of cotton candy and forgot to breathe! 🍭",
      "**{player1}** was crushed flat by a rogue wheel of cheese rolling down a steep hill! 🧀",
      "**{player1}** tried to eat soup with a knife and accidentally poked a hole in the universe! 🌌",
      "**{player1}** got locked in a pantry with a hungry wild badger! 🦡",
      "**{player1}** drank too much carbonated water and exploded from internal pressure! 🫧",
      "**{player1}** tried to steal honey directly from a hive of mutated killer bees! 🐝",
      "**{player1}** ate a piece of cake that was actually made of concrete! 🎂",
      "**{player1}** tripped over a rogue pineapple and fell face-first into a pit of spikes! 🍍",
      "**{player1}** tried to microwave an egg, causing a localized nuclear blast! 🥚"
    ];

    const combatEvents = [
      "**{player1}** turned **{player2}** into a green bean casserole! 🍲", 
      "**{player1}** blasted **{player2}** away with a blazing hot slice of pizza! 🍕",
      "**{player1}** stole **{player2}**'s legendary golden fry and executed them! 🍟", 
      "**{player1}** knocked out **{player2}** permanently using a stale baguette! 🥖",
      "**{player1}** made **{player2}** slide off the map into the void with slippery maple syrup! 🥞", 
      "**{player1}** pelted **{player2}** with rock-hard meatballs until they collapsed! 🧆",
      "**{player1}** trapped **{player2}** inside a giant waffle iron and closed the lid! 🧇", 
      "**{player1}** blinded **{player2}** with a mountain of whipped cream, sending them over the edge! 🧁",
      "**{player1}** defeated **{player2}** in a brutal, fatal spicy chicken wing showdown! 🍗", 
      "**{player1}** used a high-pressure mustard bottle to launch **{player2}** into a brick wall! 🌭",
      "**{player1}** encased **{player2}** inside a massive solid block of gelatin! 🍮", 
      "**{player1}** rolled a heavy jawbreaker down a ramp, flattening **{player2}**! 🔴",
      "**{player1}** over-seasoned **{player2}**'s meal, causing a fatal sneezing fit out of bounds! 🫙", 
      "**{player1}** used a giant fork to catapult **{player2}** straight into orbit! 🍴",
      "**{player1}** hypnotized **{player2}** with a swirling Cinnabon and led them off a fatal ledge! 🌀", 
      "**{player1}** unleashed hungry flesh-eating mice to strip **{player2}**, forcing an elimination! 🧀",
      "**{player1}** trapped **{player2}** inside a giant toaster set to extra crispy! 🍞", 
      "**{player1}** popped a giant bubblegum bubble, blowing **{player2}** entirely out of the arena! 🫧",
      "**{player1}** knocked **{player2}** out cold with a heavy cast-iron skillet! 🍳", 
      "**{player1}** choked **{player2}** out using a giant lasso of string cheese! 🫕",
      "**{player1}** hit **{player2}** with a critical, fatal strike from a frozen fish fillet! 🐟", 
      "**{player1}** threw a spiked pineapple directly at **{player2}**, eliminating them! 🍍",
      "**{player1}** locked **{player2}** inside a dark pantry and swallowed the key forever! 🗝️", 
      "**{player1}** used an oversized pepper grinder to completely dust and suffocate **{player2}**! 🌶️",
      "**{player1}** forced **{player2}** to eat a raw radioactive lemon, causing them to shrivel up and vanish! 🍋",
      "**{player1}** forced **{player2}** to eat pineapple on pizza. **{player2}** couldn't take the emotional damage and left the game! 🍍",
      "**{player1}** knocked **{player2}** out cold with a heavy, frozen salmon! 🐟",
      "**{player1}** hijacked **{player2}**'s highly coveted airfryer, leaving them to starve in the cold! 🍟",
      "**{player1}** turned **{player2}** into a human kebab and served them with extra garlic sauce! 🥙",
      "**{player1}** challenged **{player2}** to a sushi-eating contest, where **{player2}** exploded from too much rice! 🍣",
      "**{player1}** covered **{player2}**'s shoes in sticky peanut butter, causing them to slide directly out of the arena! 🥜",
      "**{player1}** tied **{player2}** to a giant spinning doner spit and turned the grill to maximum! 🧆",
      "**{player1}** fired a barrage of rock-hard, burnt bitterballs at **{player2}**! ☄️",
      "**{player1}** beat **{player2}** with a massive leek until there was nothing left of them! 🥬",
      "**{player1}** lured **{player2}** into a trap with an 'all-you-can-eat' voucher and locked the door forever! 🎟️",
      "**{player1}** aggressively threw a jar of boiling hot queso dip onto **{player2}**! 🧀",
      "**{player1}** shoved a whole durian down **{player2}**'s throat, knocking them out instantly! 🍈",
      "**{player1}** used a giant celery stick like a baseball bat and hit a home run with **{player2}**! 🥬",
      "**{player1}** drowned **{player2}** in a sea of extra spicy sriracha sauce! 🥵",
      "**{player1}** squeezed a lime directly into **{player2}**'s eyes and pushed them off a cliff! 🍋",
      "**{player1}** whacked **{player2}** over the head with a massive block of frozen butter! 🧈"
    ];

    const safeEventsDuo = [
      "**{player1}** and **{player2}** put aside their hunger and shared a giant pizza. Safe for now! 🍕",
      "**{player1}** and **{player2}** had an intense staring contest over a cookie, but both survived. 🍪",
      "**{player1}** and **{player2}** built a burger bunker together and stayed hidden. 🍔",
      "**{player1}** and **{player2}** discovered a secret candy cave full of supplies. 🍬",
      "**{player1}** and **{player2}** roasted marshmallows together while avoiding danger. 🔥",
      "**{player1}** and **{player2}** teamed up to scare away a giant angry goose. 🪿",
      "**{player1}** and **{player2}** found matching frying pans and agreed on a temporary truce. 🍳",
      "**{player1}** and **{player2}** spent the day fishing instead of fighting. 🎣",
      "**{player1}** and **{player2}** hid inside a giant refrigerator until the danger passed. 🧊",
      "**{player1}** and **{player2}** cooked pancakes together and forgot they were supposed to fight. 🥞",
      "**{player1}** and **{player2}** found an abandoned chocolate fountain and decided to dip snacks instead of fighting! 🍫",
      "**{player1}** and **{player2}** held a peaceful picnic in the eye of the storm and shared garlic bread. 🥖",
      "**{player1}** helped **{player2}** open a stubborn bag of potato chips. Teamwork makes the dream work! 🥔",
      "**{player1}** and **{player2}** argued intensely about whether mayo or ketchup belongs on fries, but both stayed alive. 🍟",
      "**{player1}** and **{player2}** found a hidden pancake house and took a well-deserved break. 🥞",
      "**{player1}** offered **{player2}** a sip of their ice-cold energy drink. True friendship in the arena! ⚡",
      "**{player1}** and **{player2}** hid together under a giant wok until the danger passed. 🍳",
      "**{player1}** and **{player2}** played tic-tac-toe using gingerbread cookies and kept the peace. 🥮",
      "**{player1}** shared their extra blankets with **{player2}** during a freezing night in the arena. 🏕️",
      "**{player1}** and **{player2}** teamed up to rob a vending machine and split the loot 50/50. 🥤"
    ];

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🏁 The Hangry Games Have Begun!')
        .setColor(0xED4245)
        .setDescription(`**${survivors.length} tributes** step up to the dining table. Let the bloodbath begin!`)
      ]
    });
    await sleep(4000);

    while (survivors.length > 1) {
      if (!activeGames.has(guildId)) return;

      const listMentions = survivors.map(id => `• <@${id}>`).join('\n');
      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle(`🍔 ${survivors.length} hangry people remaining!`)
          .setColor(0x2F3136)
          .setDescription(`\`\`\`md\n# Survivors Round ${round}\n\`\`\`\n${listMentions}`)
        ]
      });
      await sleep(3500);

      const deadThisRound = new Set();
      let pool = [...survivors];
      pool.sort(() => Math.random() - 0.5);

      while (pool.length > 0) {
        if (!activeGames.has(guildId)) return;

        if (pool.length === 1) {
          const player = pool.pop();
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

        const player1 = pool.pop();
        const player2 = pool.pop();

        const randEvent = Math.random();

        // 1. VOTING PHASE (30% Chance)
        if (randEvent < 0.30) {
          let u1Name = 'Player 1', u2Name = 'Player 2';
          try {
            u1Name = (await interaction.client.users.fetch(player1)).username;
            u2Name = (await interaction.client.users.fetch(player2)).username;
          } catch(err){}

          const voteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vote_${player1}`).setLabel(`Save ${u1Name}`).setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId(`vote_${player2}`).setLabel(`Save ${u2Name}`).setStyle(ButtonStyle.Primary).setEmoji('🛡️')
          );

          const voteEmbed = new EmbedBuilder()
            .setTitle('👀 The Dead got picky about the menu...')
            .setColor(0x5865F2)
            .setDescription(`**The arena is hungry!**\n\nChoose who you want to **save** from death! Voting costs **${VOTE_COST} Coins**.\n\n🛡️ **${u1Name}**: 0 votes\n🛡️ **${u2Name}**: 0 votes\n\n*If a player reaches **${REQUIRED_VOTES_TO_SAVE} votes**, BOTH shall live! Otherwise, the one with fewer votes is executed.*`);

          const voteMessage = await channel.send({ embeds: [voteEmbed], components: [voteRow] });

          const votes = { [player1]: 0, [player2]: 0 };
          const collector = voteMessage.createMessageComponentCollector({ time: 15000 });

          collector.on('collect', async btnInteraction => {
            const targetId = btnInteraction.customId.split('_')[1];
            const voterId = btnInteraction.user.id;

            if (voterId === targetId) {
              return btnInteraction.reply({ content: '❌ You cannot use coins to save yourself!', flags: 64 });
            }

            const voterBalance = userBalances.get(voterId) || 0;
            if (voterBalance < VOTE_COST) {
              return btnInteraction.reply({ content: `❌ You do not have enough coins! A vote costs **${VOTE_COST} Coins**.`, flags: 64 });
            }

            userBalances.set(voterId, voterBalance - VOTE_COST);
            votes[targetId]++;

            const updatedEmbed = EmbedBuilder.from(voteMessage.embeds[0])
              .setDescription(`**The arena is hungry!**\n\nChoose who you want to **save** from death! Voting costs **${VOTE_COST} Coins**.\n\n🛡️ **${u1Name}**: ${votes[player1]} votes\n🛡️ **${u2Name}**: ${votes[player2]} votes`);
            
            await voteMessage.edit({ embeds: [updatedEmbed] });
            await btnInteraction.reply({ content: `✅ You spent ${VOTE_COST} coins to help save <@${targetId}>!`, flags: 64 });
          });

          await new Promise(resolve => collector.on('end', resolve));

          let resultEmbed = new EmbedBuilder();

          if (votes[player1] >= REQUIRED_VOTES_TO_SAVE || votes[player2] >= REQUIRED_VOTES_TO_SAVE) {
            resultEmbed.setTitle('👀 Both shall live!')
              .setColor(0x57F287)
              .setDescription(`The community gathered enough coins! Both **${u1Name}** and **${u2Name}** shall live to fight another day! 🌤️`);
            pool.push(player1, player2);
          } else {
            let loser = player1;
            let winner = player2;

            if (votes[player1] > votes[player2]) {
              loser = player2;
              winner = player1;
            } else if (votes[player1] === votes[player2] && Math.random() < 0.5) {
              loser = player2;
              winner = player1;
            }

            deadThisRound.add(loser);
            const currentBal = userBalances.get(winner) || 0;
            userBalances.set(winner, currentBal + COINS_PER_KILL);

            resultEmbed.setTitle('🪓 Elimination Result!')
              .setColor(0xED4245)
              .setDescription(`**<@${winner}>** executed **<@${loser}>** because the voting goal was not reached!\n\n🪙 **<@${winner}> earns +${COINS_PER_KILL} Hangry Coins!**`);
            
            try {
              // FIX VOOR VOTE: Pakt de profielfoto van de verliezer (degene die doodgaat)
              const deadUser = await interaction.client.users.fetch(loser);
              resultEmbed.setThumbnail(deadUser.displayAvatarURL({ dynamic: true, size: 256 }));
            } catch(err){}
          }

          await voteMessage.edit({ components: [] });
          await channel.send({ embeds: [resultEmbed] });
          await sleep(4000);

        // 2. DUO SAFE EVENT (25% Chance)
        } else if (randEvent < 0.55) {
          let embed = new EmbedBuilder().setColor(0x3498DB);
          const eventText = safeEventsDuo[Math.floor(Math.random() * safeEventsDuo.length)]
            .replace(/{player1}/g, `<@${player1}>`).replace(/{player2}/g, `<@${player2}>`);
          
          try {
            const user = await interaction.client.users.fetch(player1);
            embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
          } catch (err) {}

          embed.setDescription(eventText);
          await channel.send({ embeds: [embed] });
          await sleep(3500);

        // 3. REGULAR COMBAT BATTLE OR SOLO ACCIDENT (45% Chance)
        } else {
          let embed = new EmbedBuilder().setColor(0xE74C3C);
          let eventText = "";

          if (Math.random() < 0.5) {
            // GEVECHT: Player1 vermoordt Player2
            eventText = combatEvents[Math.floor(Math.random() * combatEvents.length)]
              .replace(/{player1}/g, `<@${player1}>`).replace(/{player2}/g, `<@${player2}>`);
            deadThisRound.add(player2);
            pool.push(player1);

            const currentBal = userBalances.get(player1) || 0;
            userBalances.set(player1, currentBal + COINS_PER_KILL);
            
            try {
              // FIX: Dit haalt nu specifiek de profielfoto van PLAYER 2 (het slachtoffer) op!
              const victimUser = await interaction.client.users.fetch(player2);
              embed.setThumbnail(victimUser.displayAvatarURL({ dynamic: true, size: 256 }));
            } catch (err) { console.error(err); }
          } else {
            // ACCIDENT: Player1 gaat in z'n eentje dood
            eventText = soloDeaths[Math.floor(Math.random() * soloDeaths.length)].replace(/{player1}/g, `<@${player1}>`);
            deadThisRound.add(player1);
            pool.push(player2);

            try {
              // Hier gaat Player1 dood, dus z'n eigen pfp is correct
              const user = await interaction.client.users.fetch(player1);
              embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
            } catch (err) { console.error(err); }
          }

          embed.setDescription(eventText);
          await channel.send({ embeds: [embed] });
          await sleep(3500);
        }
      }

      survivors = survivors.filter(id => !deadThisRound.has(id));

      if (survivors.length === 0) {
        survivors = [Array.from(game.players)[Math.floor(Math.random() * game.players.size)]];
      }
      round++;
    }

    if (!activeGames.has(guildId)) return;

    // --- WINNER ANNOUNCEMENT ---
    const winnerId = survivors[0];
    const sponsorText = game.sponsorId ? `<@${game.sponsorId}>` : `<@${game.hostId}>`;
    let winnerEmbed = new EmbedBuilder()
      .setTitle('👑 We have a survivor! 👑')
      .setColor(0x57F287)
      .setDescription(`🏆 **CONGRATULATIONS <@${winnerId}>!** 🏆\n\nYou are the last one standing after an absolute bloodbath!\n\n🎁 **Prize:** ${game.prize}\n📣 **Sponsor:** ${sponsorText}`)
      .setFooter({ text: "Thanks for playing Oscar's Hangry Games!" });

    try {
      const winnerUser = await interaction.client.users.fetch(winnerId);
      winnerEmbed.setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 512 }));
    } catch (err) { console.error(err); }

    await channel.send({ content: `🎉 Congratulations <@${winnerId}>!`, embeds: [winnerEmbed] });
    activeGames.delete(guildId);
  }
};
