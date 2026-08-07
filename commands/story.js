const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('story')
    .setDescription('Read the legendary adventure of Jelle and Oscar! 🌽'),

  async execute(interaction) {
    const storyEmbed = new EmbedBuilder()
      .setTitle('🗺️ The Quest for the Golden Corn')
      .setDescription(
        'It all started in the yard of that old mill around noon. Jelle, that mischievous duck, was up to something again, ' +
        'and his buddy Oscar was waiting right behind him, tongue hanging out, always ready to chase after him. ' +
        'The attic of the mill was so full of dust and grime that anyone stepping inside would sneeze their head off. ' +
        'While Jelle was pecking around inside an old, rotted chest thrown in the corner, he pulled out a strange, folded-up piece of ancient leather.\n\n' +
        
        'Oscar brought his nose close, sniffed it, tilted his head, and looked at his friend. Jelle brushed the dust off with his wings and opened the map: ' +
        'written on it with crooked lines was "The Cave of Forgotten Flavors" and at the very end, a circled "Golden Corn." ' +
        'Jelle\'s eyes sparkled with joy, and Oscar wagged his tail so fast he almost lost his balance and fell. They set off immediately.\n\n' +
        
        'The first obstacle popped up right away. In front of them was a roaring mountain river, foaming as it crashed against the rocks. ' +
        'The wooden bridge over it had long since collapsed, and the few rotten planks left on the ground didn\'t look trustworthy at all. ' +
        'Jelle instantly took to the air, flew across to the other side, grabbed a sturdy piece of rope left there in his beak, and flew back to Oscar\'s side, ' +
        'throwing him the end of the rope. Oscar caught the end firmly in his strong teeth and pulled, while Jelle guided it from above and tied it securely to a thick stump. ' +
        'Just like that, they managed a makeshift crossing.\n\n' +
        
        'Continuing their journey, they entered the "Whispering Forest." The air here felt different; the trees seemed to whisper among themselves, ' +
        'and the rustle of the leaves sounded a bit eerie. Oscar kept his nose to the ground, focusing entirely on his job—because without his sense of smell, ' +
        'getting lost in this forest was a matter of moments. Jelle, on the other hand, flew high, looking down from above, spotting hidden branch traps and holes ' +
        'ahead of time and giving warning sounds to alert Oscar.\n\n' +
        
        'In a way, Jelle was the team\'s eyes, and Oscar was its muscle.\n\n' +
        
        'Finally, behind a dark cliff at the end of the forest, the mouth of the cave came into view. As they stepped inside, the air suddenly turned cool. ' +
        'Deep within, sitting atop a stone pedestal, was the shining "Golden Corn" just like on the map. After jumping around in excitement together for a bit, ' +
        'they grabbed the treasure and headed back. That day, everyone in the village was talking about their small but thrilling adventure.'
      )
      .setColor(0xF1C40F)
      .setFooter({ text: 'A legendary tale of Jelle & Oscar • Made by eclipscore' })
      .setTimestamp();

    return interaction.reply({ embeds: [storyEmbed] });
  },
};
