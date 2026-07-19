require('dotenv').config();

const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
} = require('discord.js');

const {
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} = require('@discordjs/voice');

const REQUIRED_ENV = [
  'DISCORD_BOT_TOKEN',
  'GUILD_ID',
  'VOICE_CHANNEL_ID',
];

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());

if (missingEnv.length > 0) {
  console.error(
    `Missing values in .env: ${missingEnv.join(', ')}`
  );
  process.exit(1);
}

const TOKEN = process.env.DISCORD_BOT_TOKEN.trim();
const GUILD_ID = process.env.GUILD_ID.trim();
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID.trim();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

let shuttingDown = false;
let joinInProgress = false;
let reconnectTimer = null;

const watchedConnections = new WeakSet();

function scheduleJoin(reason, delayMs = 2_000) {
  if (shuttingDown || reconnectTimer) return;

  console.log(
    `[VOICE] ${reason}. Retrying in ${Math.ceil(delayMs / 1000)} second(s)...`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void joinTargetVoice();
  }, delayMs);
}

function watchConnection(connection) {
  if (watchedConnections.has(connection)) return;
  watchedConnections.add(connection);

  connection.on('error', (error) => {
    console.error('[VOICE] Connection error:', error.message);
    scheduleJoin('Voice connection error', 3_000);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    // Give the voice library time to recover a temporary network disconnect.
    setTimeout(() => {
      if (shuttingDown) return;

      const currentConnection = getVoiceConnection(GUILD_ID);
      const isReady =
        currentConnection?.state.status === VoiceConnectionStatus.Ready;
      const isInTarget =
        currentConnection?.joinConfig.channelId === VOICE_CHANNEL_ID;

      if (!isReady || !isInTarget) {
        scheduleJoin('Bot was disconnected or moved', 1_000);
      }
    }, 5_000);
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (!shuttingDown) {
      scheduleJoin('Voice connection was destroyed', 2_000);
    }
  });
}

async function joinTargetVoice() {
  if (shuttingDown || joinInProgress || !client.isReady()) return;

  joinInProgress = true;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

    if (!channel || !channel.isVoiceBased()) {
      throw new Error(
        'VOICE_CHANNEL_ID does not belong to a voice or stage channel.'
      );
    }

    const me = guild.members.me ?? await guild.members.fetchMe();
    const permissions = channel.permissionsFor(me);

    const missingPermissions = [];

    if (!permissions?.has(PermissionsBitField.Flags.ViewChannel)) {
      missingPermissions.push('View Channel');
    }

    if (!permissions?.has(PermissionsBitField.Flags.Connect)) {
      missingPermissions.push('Connect');
    }

    if (missingPermissions.length > 0) {
      throw new Error(
        `The bot is missing permission(s): ${missingPermissions.join(', ')}`
      );
    }

    const existingConnection = getVoiceConnection(guild.id);
    const alreadyReady =
      existingConnection?.state.status === VoiceConnectionStatus.Ready;
    const alreadyInTarget =
      me.voice.channelId === channel.id &&
      existingConnection?.joinConfig.channelId === channel.id;

    if (alreadyReady && alreadyInTarget) {
      console.log(`[VOICE] Already connected to: ${channel.name}`);
      return;
    }

    // If a connection already exists in this server, this moves it back
    // to the target channel rather than creating a second connection.
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    watchConnection(connection);

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      20_000
    );

    console.log(`[VOICE] Connected to: ${channel.name}`);
  } catch (error) {
    console.error('[VOICE] Join failed:', error.message);
    scheduleJoin('Join attempt failed', 5_000);
  } finally {
    joinInProgress = false;
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[BOT] Logged in as ${readyClient.user.tag}`);
  void joinTargetVoice();
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (!client.user || newState.id !== client.user.id || shuttingDown) {
    return;
  }

  // If someone disconnects the bot or drags it to another room,
  // send it back to the configured target room.
  if (newState.channelId !== VOICE_CHANNEL_ID) {
    scheduleJoin('Bot left the target voice channel', 1_000);
  }
});

client.on(Events.Error, (error) => {
  console.error('[BOT] Client error:', error);
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[BOT] Received ${signal}. Stopping...`);

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const connection = getVoiceConnection(GUILD_ID);
  if (
    connection &&
    connection.state.status !== VoiceConnectionStatus.Destroyed
  ) {
    connection.destroy();
  }

  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (error) => {
  console.error('[PROCESS] Unhandled rejection:', error);
});

client.login(TOKEN).catch((error) => {
  console.error('[BOT] Login failed:', error.message);
  process.exit(1);
});
