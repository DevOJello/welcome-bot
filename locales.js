const translations = {
  // 🇬🇧 ENGLISH (Default)
  en: {
    // General
    no_permission: '⚠️ You do not have permission to use this command.',
    guild_only: '⚠️ This command can only be used inside a server.',

    // Logging Commands
    log_channel_set: 'All server logs will now be sent to {channel}.',
    log_toggle_success: 'Logging category **{category}** is now **{status}**.',

    // Poll Command
    poll_title: '📊 New Poll',
    poll_footer: 'Started by {user}',
    poll_yes: 'Yes',
    poll_no: 'No',
    poll_success: '✅ Poll created!',

    // Ticket Command
    ticket_not_configured: '⚠️ Ticket system not configured.',
    ticket_already_open: '⚠️ You already have an open ticket: {channel}',
    ticket_created: '✅ Your ticket: {channel}',
    ticket_closed_title: '🔒 Ticket Closed',
    ticket_closed_desc: 'Closed by {user}.',

    // Language Command
    lang_updated: '✅ Bot language updated to **English**!'
  },

  // 🇳🇱 DUTCH
  nl: {
    // Algemeen
    no_permission: '⚠️ Je hebt geen toestemming om dit commando te gebruiken.',
    guild_only: '⚠️ Dit commando kan alleen in een server gebruikt worden.',

    // Logging Commando's
    log_channel_set: 'Alle serverlogs worden vanaf nu verzonden naar {channel}.',
    log_toggle_success: 'Logcategorie **{category}** is nu **{status}**.',

    // Poll Commando
    poll_title: '📊 Nieuwe Peiling',
    poll_footer: 'Gestart door {user}',
    poll_yes: 'Ja',
    poll_no: 'Nee',
    poll_success: '✅ Peiling aangemaakt!',

    // Ticket Commando
    ticket_not_configured: '⚠️ Het ticketsysteem is nog niet ingesteld.',
    ticket_already_open: '⚠️ Je hebt al een open ticket: {channel}',
    ticket_created: '✅ Je ticket is aangemaakt: {channel}',
    ticket_closed_title: '🔒 Ticket Gesloten',
    ticket_closed_desc: 'Gesloten door {user}.',

    // Language Commando
    lang_updated: '✅ De taal van de bot is ingesteld op **Nederlands**!'
  }
};

/**
 * Fetches the translated text for a given key and language.
 * Falls back to English ('en') if the language or key is missing.
 */
function t(lang, key, placeholders = {}) {
  const language = translations[lang] ? lang : 'en';
  let text = translations[language]?.[key] || translations['en']?.[key] || key;

  for (const [placeholder, value] of Object.entries(placeholders)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }

  return text;
}

module.exports = { t };