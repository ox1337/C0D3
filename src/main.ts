// Serveur web pour veille
import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('TediCross est en ligne !');
});

app.listen(port, () => {
    console.log(`Le serveur web est démarré et écoute sur le port ${port}`);
});

// General stuff
import semver from "semver";
import yargs from "yargs";
import path from "path";
import { Logger } from "./Logger";
import { MessageMap } from "./MessageMap";
import { Bridge, BridgeProperties } from "./bridgestuff/Bridge";
import { BridgeMap } from "./bridgestuff/BridgeMap";
import { Settings, TelegramSettings, DiscordSettings, BridgeSettings } from "./settings/Settings";
import jsYaml from "js-yaml";
import fs from "fs";
import R from "ramda";
import os from "os";

// Telegram stuff
import { Telegraf } from "telegraf";
import { setup as telegramSetup, TediTelegraf } from "./telegram2discord/setup";

// Discord stuff
import { Client as DiscordClient, GatewayIntentBits, ActivityType } from "discord.js";
import { setup as discordSetup } from "./discord2telegram/setup";

if (!semver.gte(process.version, "18.0.0")) {
    console.log(`TediCross requires at least nodejs 18.0. Your version is ${process.version}`);
    process.exit();
}

/*************
 * TediCross *
 *************/

// --- DEBUT DES MODIFICATIONS ---

// On ne lit plus le fichier settings.yaml.
// On crée un objet de configuration directement à partir des variables d'environnement.
// On utilise '||' pour fournir une valeur par défaut vide si la variable d'environnement n'existe pas.
const rawSettingsObj = {
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN || "",
        useFirstNameInsteadOfUsername: process.env.TELEGRAM_USE_FIRST_NAME_INSTEAD_OF_USERNAME === 'true',
        colonAfterSenderName: process.env.TELEGRAM_COLON_AFTER_SENDER_NAME === 'true',
        skipOldMessages: process.env.TELEGRAM_SKIP_OLD_MESSAGES === 'true',
        sendEmojiWithStickers: process.env.TELEGRAM_SEND_EMOJI_WITH_STICKERS === 'true',
        useCustomEmojiFilter: process.env.TELEGRAM_USE_CUSTOM_EMOJI_FILTER === 'true',
        replaceAtWithHash: process.env.TELEGRAM_REPLACE_AT_WITH_HASH === 'true',
        replaceExcessiveSpaces: process.env.TELEGRAM_REPLACE_EXCESSIVE_SPACES === 'true',
        removeNewlineSpaces: process.env.TELEGRAM_REMOVE_NEWLINE_SPACES === 'true',
        suppressFileTooBigMessages: process.env.TELEGRAM_SUPPRESS_FILE_TOO_BIG_MESSAGES === 'true',
        suppressThisIsPrivateBotMessage: process.env.TELEGRAM_SUPPRESS_THIS_IS_PRIVATE_BOT_MESSAGE === 'true'
    },
    discord: {
        useNickname: process.env.DISCORD_USE_NICKNAME === 'true',
        token: process.env.DISCORD_TOKEN || "",
        skipOldMessages: process.env.DISCORD_SKIP_OLD_MESSAGES === 'true',
        replyLength: parseInt(process.env.DISCORD_REPLY_LENGTH || "100", 10),
        maxReplyLines: parseInt(process.env.DISCORD_MAX_REPLY_LINES || "2", 10),
        suppressThisIsPrivateBotMessage: process.env.DISCORD_SUPPRESS_THIS_IS_PRIVATE_BOT_MESSAGE === 'true',
        enableCustomStatus: process.env.DISCORD_ENABLE_CUSTOM_STATUS === 'true',
        customStatusMessage: process.env.DISCORD_CUSTOM_STATUS_MESSAGE || "TediCross"
    },
    bridges: JSON.parse(process.env.CHANNELS_TO_BRIDGE || "[]"),
    debug: process.env.DEBUG === 'true',
    messageTimeoutAmount: parseInt(process.env.MESSAGE_TIMEOUT_AMOUNT || "24", 10),
    messageTimeoutUnit: process.env.MESSAGE_TIMEOUT_UNIT || "hours",
    persistentMessageMap: process.env.PERSISTENT_MESSAGE_MAP === 'true'
};

const settings = Settings.fromObj(rawSettingsObj);
const logger = new Logger(settings.debug);
logger.info("Configuration loaded from environment variables.");

// --- FIN DES MODIFICATIONS ---

// Create a Telegram bot
const tgBot = new Telegraf(settings.telegram.token);

// Create a Discord bot
const dcBot = new DiscordClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    presence: settings.discord.enableCustomStatus
        ? {
                activities: [
                    {
                        name: settings.discord.customStatusMessage,
                        type: ActivityType.Custom
                    }
                ]
          }
        : {}
});

// Create a message ID map
const messageMap = new MessageMap(settings, logger, args.dataDir);

// Create the bridge map
const bridgeMap = new BridgeMap(settings.bridges.map((bridgeSettings: BridgeProperties) => new Bridge(bridgeSettings)));

/*********************
 * Set up the bridge *
 *********************/

discordSetup(logger, dcBot, tgBot, messageMap, bridgeMap, settings, args.dataDir);
telegramSetup(logger, tgBot as TediTelegraf, dcBot, messageMap, bridgeMap, settings);
