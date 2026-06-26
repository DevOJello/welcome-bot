const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Welcome Bot online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Load slash commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && typeof command.data.toJSON === 'function') {
    client.commands.set(command.data.name, command);
    console.log(`✔ Loaded: ${command.data.name}`);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath);

for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.WELCOME_TOKEN);

client.once('clientReady', async () => {
  console.log(`👋 Welcome Bot logged in as ${client.user.tag}`);

  try {
    const commandsJSON = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    if (!process.env.WELCOME_CLIENT_ID) return console.warn('WELCOME_CLIENT_ID not set');

    await rest.put(
      Routes.applicationCommands(process.env.WELCOME_CLIENT_ID),
      { body: commandsJSON }
    );
    console.log('✅ Welcome commands deployed globally.');
  } catch (err) {
    console.error('Failed to deploy commands:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Something went wrong.', flags: 64 });
      } else {
        await interaction.reply({ content: '❌ Something went wrong.', flags: 64 });
      }
    } catch {}
  }
});

client.login(process.env.WELCOME_TOKEN);