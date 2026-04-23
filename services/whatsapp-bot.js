const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');

const BOT_STATUS = {
  DISCONNECTED: 'Disconnected',
  AUTHENTICATING: 'Authenticating',
  CONNECTED: 'Connected'
};

const STATUS_BROADCAST_ID = 'status@broadcast';
const STORE_FLUSH_INTERVAL_MS = 10_000;
const DEFAULT_STATUS_BACKGROUND = '#0f7a63';
const DEFAULT_STATUS_FONT = 1;
const SUPPORTED_MESSAGE_TYPES = new Set([
  'conversation',
  'extendedTextMessage',
  'imageMessage',
  'videoMessage'
]);

let baileysModulePromise = null;

async function loadBaileysModule() {
  if (!baileysModulePromise) {
    baileysModulePromise = import('@whiskeysockets/baileys');
  }

  return baileysModulePromise;
}

class WhatsAppRelayBot {
  constructor({ configStore }) {
    this.configStore = configStore;
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info'
    }).child({ scope: 'whatsapp-bot' });
    this.baileysLogger = pino({
      level: process.env.BAILEYS_LOG_LEVEL || 'silent'
    });

    this.baileys = null;
    this.socket = null;
    this.store = null;
    this.connectionStatus = BOT_STATUS.DISCONNECTED;
    this.rawWhatsappState = 'INITIALIZING';
    this.qrCodeDataUrl = null;
    this.lastError = null;
    this.lastActivityAt = null;
    this.clientReady = false;
    this.groupCache = [];
    this.contactCache = [];
    this.groupMetadataIndex = {};
    this.activeSocketToken = 0;
    this.storeWriteInterval = null;
    this.reconnectTimer = null;
    this.isShuttingDown = false;
    this.authDir = path.join(__dirname, '..', '.baileys_auth', 'relay-dashboard');
    this.storeFilePath = path.join(__dirname, '..', 'baileys-store.json');
  }

  async initialize() {
    this.baileys = await loadBaileysModule();

    if (!this.store) {
      this.store = createDirectoryStore(this.logger.child({ scope: 'directory-store' }));

      this.restoreStore();
      this.startStorePersistence();
    }

    await fs.promises.mkdir(this.authDir, { recursive: true });
    await this.connect();
  }

  getStatusSnapshot() {
    return {
      connectionStatus: this.connectionStatus,
      rawWhatsappState: this.rawWhatsappState,
      qrCodeDataUrl: this.qrCodeDataUrl,
      lastError: this.lastError,
      lastActivityAt: this.lastActivityAt,
      sessionMode: 'BaileysMultiFileAuthState',
      isReady: this.isClientReady()
    };
  }

  isClientReady() {
    return Boolean(this.socket && this.clientReady && this.connectionStatus === BOT_STATUS.CONNECTED);
  }

  async getGroups() {
    if (!this.isClientReady()) {
      return this.groupCache;
    }

    try {
      const groups = await this.readGroupsFromSocket();
      this.groupCache = groups;
      return groups;
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to refresh groups from Baileys, falling back to cache');
      return this.groupCache;
    }
  }

  async getContacts() {
    if (!this.isClientReady()) {
      return this.contactCache;
    }

    try {
      const contacts = await this.readContactsFromSocket();
      this.contactCache = contacts;
      return contacts;
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to refresh contacts from Baileys, falling back to cache');
      return this.contactCache;
    }
  }

  async shutdown() {
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.storeWriteInterval) {
      clearInterval(this.storeWriteInterval);
      this.storeWriteInterval = null;
    }

    if (this.store) {
      try {
        this.store.writeToFile(this.storeFilePath);
      } catch (error) {
        this.logger.warn({ err: error }, 'Unable to flush Baileys store during shutdown');
      }
    }

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch (error) {
        this.logger.warn({ err: error }, 'Failed to end Baileys socket cleanly');
      } finally {
        this.socket = null;
      }
    }

    this.clientReady = false;
  }

  async connect() {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const { default: makeWASocket, Browsers, useMultiFileAuthState } = this.baileys;
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {
        // Ignore socket disposal errors while reconnecting.
      }
    }

    const socketToken = this.activeSocketToken + 1;
    this.activeSocketToken = socketToken;
    this.clientReady = false;
    this.qrCodeDataUrl = null;
    this.setStatus(BOT_STATUS.AUTHENTICATING, {
      rawWhatsappState: 'CONNECTING',
      lastError: null
    });

    const socket = makeWASocket({
      auth: state,
      logger: this.baileysLogger,
      browser: Browsers?.windows?.('Desktop'),
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    this.socket = socket;
    this.store.bind(socket.ev);

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('contacts.upsert', () => {
      if (this.isCurrentSocket(socketToken, socket)) {
        this.refreshStoreBackedCaches();
      }
    });
    socket.ev.on('contacts.update', () => {
      if (this.isCurrentSocket(socketToken, socket)) {
        this.refreshStoreBackedCaches();
      }
    });
    socket.ev.on('chats.upsert', () => {
      if (this.isCurrentSocket(socketToken, socket)) {
        this.refreshStoreBackedCaches();
      }
    });
    socket.ev.on('chats.update', () => {
      if (this.isCurrentSocket(socketToken, socket)) {
        this.refreshStoreBackedCaches();
      }
    });
    socket.ev.on('groups.update', (updates) => {
      if (!this.isCurrentSocket(socketToken, socket) || !Array.isArray(updates)) {
        return;
      }

      updates.forEach((update) => {
        const groupId = normalizeId(update?.id);
        if (!groupId) {
          return;
        }

        this.groupMetadataIndex[groupId] = {
          ...(this.groupMetadataIndex[groupId] || {}),
          ...update
        };
      });
    });
    socket.ev.on('connection.update', (update) => {
      if (!this.isCurrentSocket(socketToken, socket)) {
        return;
      }

      this.handleConnectionUpdate(update, socketToken).catch((error) => {
        this.logger.error({ err: error }, 'Unhandled Baileys connection.update failure');
      });
    });
    socket.ev.on('messages.upsert', (event) => {
      if (!this.isCurrentSocket(socketToken, socket)) {
        return;
      }

      this.handleMessagesUpsert(event).catch((error) => {
        this.logger.error({ err: error }, 'Unhandled Baileys messages.upsert failure');
      });
    });
  }

  async handleConnectionUpdate(update, socketToken) {
    const { connection, lastDisconnect, qr } = update || {};
    this.lastActivityAt = new Date().toISOString();

    if (qr) {
      this.clientReady = false;
      this.setStatus(BOT_STATUS.AUTHENTICATING, {
        rawWhatsappState: 'WAITING_FOR_QR_SCAN',
        lastError: null
      });

      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
          width: 320,
          margin: 1
        });
      } catch (error) {
        this.qrCodeDataUrl = null;
        this.logger.warn({ err: error }, 'Failed to convert Baileys QR to data URL');
      }
    }

    if (connection === 'connecting') {
      this.clientReady = false;
      this.setStatus(BOT_STATUS.AUTHENTICATING, {
        rawWhatsappState: this.qrCodeDataUrl ? 'WAITING_FOR_QR_SCAN' : 'CONNECTING',
        lastError: null
      });
      return;
    }

    if (connection === 'open') {
      this.clientReady = true;
      this.qrCodeDataUrl = null;
      this.setStatus(BOT_STATUS.CONNECTED, {
        rawWhatsappState: 'READY',
        lastError: null
      });
      this.logger.info('Baileys socket connected');
      await this.warmDirectoryCache();
      return;
    }

    if (connection === 'close') {
      this.clientReady = false;
      this.qrCodeDataUrl = null;

      const statusCode = getDisconnectStatusCode(lastDisconnect?.error);
      const isLoggedOut = statusCode === this.baileys.DisconnectReason.loggedOut;
      const errorMessage = formatError(lastDisconnect?.error) || (isLoggedOut ? 'WhatsApp session logged out.' : 'Connection closed.');

      this.setStatus(BOT_STATUS.DISCONNECTED, {
        rawWhatsappState: isLoggedOut ? 'LOGGED_OUT' : `CONNECTION_CLOSED_${statusCode || 'UNKNOWN'}`,
        lastError: errorMessage
      });

      this.logger.warn(
        {
          code: statusCode,
          isLoggedOut,
          message: errorMessage
        },
        'Baileys socket closed'
      );

      if (!this.isShuttingDown && this.activeSocketToken === socketToken) {
        this.scheduleReconnect(isLoggedOut ? 2_500 : 1_500);
      }
    }
  }

  async handleMessagesUpsert(event) {
    if (!event || event.type !== 'notify' || !Array.isArray(event.messages)) {
      return;
    }

    for (const message of event.messages) {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        this.logger.error({ err: error, key: message?.key }, 'Failed processing incoming WhatsApp message');
      }
    }
  }

  async handleIncomingMessage(message) {
    if (!message?.key || message.key.fromMe || !message.message) {
      return;
    }

    const groupId = normalizeId(message.key.remoteJid);
    if (!groupId || groupId === STATUS_BROADCAST_ID || !groupId.endsWith('@g.us')) {
      return;
    }

    const normalizedMessage = this.baileys.normalizeMessageContent(message.message);
    const messageType = this.baileys.getContentType(normalizedMessage);

    if (!SUPPORTED_MESSAGE_TYPES.has(messageType)) {
      return;
    }

    const config = await this.configStore.readConfig();
    if (normalizeId(config.TRIGGER_GROUP_ID) !== groupId) {
      return;
    }

    const senderIdentity = await this.extractSenderIdentity(message, groupId);
    if (!isAuthorizedSender(config.AUTHORIZED_NUMBERS, senderIdentity.identifiers)) {
      this.logger.info(
        {
          groupId,
          sender: senderIdentity.primaryId || 'unknown',
          normalizedNumber: senderIdentity.normalizedNumber || 'unknown'
        },
        'Ignoring unauthorized sender in trigger group'
      );
      return;
    }

    const targetGroupIds = [...new Set((config.TARGET_GROUP_IDS || []).map(normalizeId).filter(Boolean))];
    if (!targetGroupIds.length && !config.POST_TO_STATUS) {
      this.logger.info('Matched trigger message but there are no relay groups and status publishing is disabled');
      return;
    }

    this.logger.info(
      {
        id: message.key.id,
        from: senderIdentity.primaryId,
        groupId,
        type: messageType
      },
      'Accepted trigger-group message'
    );

    await this.relayMessage(message, targetGroupIds, Boolean(config.POST_TO_STATUS));
  }

  async relayMessage(message, targetGroupIds, postToStatus) {
    const payload = await this.buildRelayPayload(message);
    if (!payload) {
      this.logger.warn({ key: message?.key }, 'Accepted message had no relayable payload');
      return;
    }

    const targetResults = await Promise.allSettled(
      targetGroupIds.map((chatId) => this.sendPayload(chatId, payload))
    );

    targetResults.forEach((result, index) => {
      const chatId = targetGroupIds[index];

      if (result.status === 'fulfilled') {
        this.logger.info({ chatId, kind: payload.kind }, 'Delivered relay payload to target group');
      } else {
        this.logger.error({ chatId, err: result.reason }, 'Failed delivering relay payload to target group');
      }
    });

    if (!postToStatus) {
      return;
    }

    if (!targetGroupIds.length) {
      this.logger.warn('POST_TO_STATUS is enabled but there are no target groups to link the group status to');
      return;
    }

    try {
      await this.sendGroupStatus(targetGroupIds, payload);
      this.logger.info({ targets: targetGroupIds.length, kind: payload.kind }, 'Published WhatsApp group status');
    } catch (error) {
      this.logger.error({ err: error }, 'Failed publishing WhatsApp group status');
    }
  }

  async buildRelayPayload(message) {
    const normalizedMessage = this.baileys.normalizeMessageContent(message.message);
    const messageType = this.baileys.getContentType(normalizedMessage);
    const text = extractMessageText(normalizedMessage, messageType);

    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      return text.trim()
        ? {
            kind: 'text',
            content: { text }
          }
        : null;
    }

    const mediaBuffer = await this.baileys.downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: this.baileysLogger,
        reuploadRequest: this.socket.updateMediaMessage
      }
    );

    if (!Buffer.isBuffer(mediaBuffer) || !mediaBuffer.length) {
      return null;
    }

    if (messageType === 'imageMessage') {
      return {
        kind: 'image',
        content: {
          image: mediaBuffer,
          caption: text || undefined,
          mimetype: normalizedMessage.imageMessage?.mimetype || undefined
        }
      };
    }

    if (messageType === 'videoMessage') {
      return {
        kind: 'video',
        content: {
          video: mediaBuffer,
          caption: text || undefined,
          mimetype: normalizedMessage.videoMessage?.mimetype || undefined,
          gifPlayback: Boolean(normalizedMessage.videoMessage?.gifPlayback) || undefined
        }
      };
    }

    return null;
  }

  async sendPayload(chatId, payload) {
    if (!this.isClientReady()) {
      throw new Error('Baileys socket is not ready.');
    }

    await this.socket.sendMessage(chatId, payload.content);
  }

  async sendGroupStatus(targetGroupIds, payload) {
    if (!this.isClientReady()) {
      throw new Error('Baileys socket is not ready.');
    }

    const statusJidList = [...new Set(targetGroupIds.map(normalizeId).filter((jid) => jid.endsWith('@g.us')))];
    if (!statusJidList.length) {
      throw new Error('No target group IDs were available for statusJidList.');
    }

    // Baileys publishes statuses by sending to status@broadcast with broadcast=true and statusJidList.
    const options = {
      broadcast: true,
      statusJidList
    };

    if (payload.kind === 'text') {
      options.backgroundColor = DEFAULT_STATUS_BACKGROUND;
      options.font = DEFAULT_STATUS_FONT;
    }

    await this.socket.sendMessage(STATUS_BROADCAST_ID, payload.content, options);
  }

  async readGroupsFromSocket() {
    const allParticipating = await this.socket.groupFetchAllParticipating();
    this.groupMetadataIndex = toMetadataIndex(allParticipating);

    const fetchedGroups = Object.values(this.groupMetadataIndex).map((metadata) => ({
      id: normalizeId(metadata.id),
      name: cleanDisplayName(metadata.subject || metadata.notify, metadata.id)
    }));

    return dedupeById([...fetchedGroups, ...this.readGroupsFromStore()]).sort(sortByDisplayName);
  }

  async readContactsFromSocket() {
    await this.ensureAllGroupMetadataLoaded();

    const storeContacts = this.readContactsFromStore();
    const participantContacts = [];

    Object.values(this.groupMetadataIndex).forEach((metadata) => {
      for (const participant of metadata.participants || []) {
        const contact =
          this.store?.contacts?.[normalizeId(participant?.phoneNumber)] ||
          this.store?.contacts?.[normalizeId(participant?.id)] ||
          this.store?.contacts?.[normalizeId(participant?.lid)];

        const participantId = [
          normalizeId(participant?.phoneNumber),
          normalizeId(contact?.id),
          normalizeId(participant?.id)
        ].find((value) => isSelectableContact(value));

        if (!participantId) {
          continue;
        }

        participantContacts.push({
          id: participantId,
          name: resolveContactName(contact, participantId),
          isMyContact: Boolean(contact && hasMeaningfulDisplayName(resolveContactName(contact, participantId), participantId))
        });
      }
    });

    return dedupeContacts([...storeContacts, ...participantContacts]).sort(sortByDisplayName);
  }

  readGroupsFromStore() {
    if (!this.store?.chats?.all) {
      return [];
    }

    try {
      return dedupeById(
        this.store.chats
          .all()
          .map((chat) => {
            const id = normalizeId(chat?.id);
            if (!id || !id.endsWith('@g.us')) {
              return null;
            }

            return {
              id,
              name: cleanDisplayName(chat?.name || chat?.subject || chat?.conversationTimestamp, id)
            };
          })
          .filter(Boolean)
      ).sort(sortByDisplayName);
    } catch (error) {
      this.logger.warn({ err: error }, 'Unable to read groups from Baileys store');
      return [];
    }
  }

  readContactsFromStore() {
    const storeContacts = Object.values(this.store?.contacts || {});

    return dedupeContacts(
      storeContacts
        .map((contact) => ({
          id: normalizeId(contact?.id),
          name: resolveContactName(contact, contact?.id),
          isMyContact: Boolean(contact && hasMeaningfulDisplayName(resolveContactName(contact, contact?.id), contact?.id))
        }))
        .filter((contact) => isSelectableContact(contact.id))
        .filter((contact) => contact.isMyContact || hasMeaningfulDisplayName(contact.name, contact.id))
    ).sort(sortByDisplayName);
  }

  async warmDirectoryCache() {
    const [groups, contacts] = await Promise.allSettled([
      this.readGroupsFromSocket(),
      this.readContactsFromSocket()
    ]);

    if (groups.status === 'fulfilled') {
      this.groupCache = groups.value;
    }

    if (contacts.status === 'fulfilled') {
      this.contactCache = contacts.value;
    }
  }

  async ensureAllGroupMetadataLoaded() {
    if (!this.isClientReady()) {
      return this.groupMetadataIndex;
    }

    try {
      const fetched = await this.socket.groupFetchAllParticipating();
      this.groupMetadataIndex = toMetadataIndex(fetched);
    } catch (error) {
      this.logger.warn({ err: error }, 'Unable to refresh all group metadata, using cached metadata');
    }

    return this.groupMetadataIndex;
  }

  async getGroupMetadata(groupId) {
    const normalizedGroupId = normalizeId(groupId);
    if (!normalizedGroupId) {
      return null;
    }

    if (this.groupMetadataIndex[normalizedGroupId]) {
      return this.groupMetadataIndex[normalizedGroupId];
    }

    if (!this.isClientReady()) {
      return null;
    }

    try {
      const metadata = await this.socket.groupMetadata(normalizedGroupId);
      this.groupMetadataIndex[normalizedGroupId] = metadata;
      return metadata;
    } catch (error) {
      this.logger.warn({ err: error, groupId: normalizedGroupId }, 'Unable to fetch single-group metadata');
      return null;
    }
  }

  async extractSenderIdentity(message, groupId) {
    const primaryId =
      normalizeId(message?.key?.participant) ||
      normalizeId(message?.participant) ||
      normalizeId(message?.key?.remoteJid);

    const identifiers = new Set();
    addIdentifierVariants(identifiers, primaryId);

    const groupMetadata = await this.getGroupMetadata(groupId);
    const participant = (groupMetadata?.participants || []).find((entry) => {
      const values = [
        normalizeId(entry?.id),
        normalizeId(entry?.phoneNumber),
        normalizeId(entry?.lid)
      ].filter(Boolean);

      return values.includes(primaryId);
    });

    addIdentifierVariants(identifiers, participant?.id);
    addIdentifierVariants(identifiers, participant?.phoneNumber);
    addIdentifierVariants(identifiers, participant?.lid);

    const storeContact =
      this.store?.contacts?.[primaryId] ||
      this.store?.contacts?.[normalizeId(participant?.id)] ||
      this.store?.contacts?.[normalizeId(participant?.phoneNumber)] ||
      this.store?.contacts?.[normalizeId(participant?.lid)];

    addIdentifierVariants(identifiers, storeContact?.id);

    return {
      primaryId,
      normalizedNumber: participant?.phoneNumber ? normalizeNumber(participant.phoneNumber) : '',
      identifiers
    };
  }

  restoreStore() {
    if (!fs.existsSync(this.storeFilePath)) {
      return;
    }

    try {
      this.store.readFromFile(this.storeFilePath);
    } catch (error) {
      this.logger.warn({ err: error }, 'Unable to restore Baileys store snapshot, starting with an empty store');
    }

    this.refreshStoreBackedCaches();
  }

  refreshStoreBackedCaches() {
    this.groupCache = this.readGroupsFromStore();
    this.contactCache = this.readContactsFromStore();
  }

  startStorePersistence() {
    if (this.storeWriteInterval) {
      return;
    }

    this.storeWriteInterval = setInterval(() => {
      try {
        this.store.writeToFile(this.storeFilePath);
      } catch (error) {
        this.logger.warn({ err: error }, 'Failed writing Baileys store snapshot');
      }
    }, STORE_FLUSH_INTERVAL_MS);

    if (typeof this.storeWriteInterval.unref === 'function') {
      this.storeWriteInterval.unref();
    }
  }

  scheduleReconnect(delayMs) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        this.logger.error({ err: error }, 'Baileys reconnect attempt failed');
        this.scheduleReconnect(3_000);
      });
    }, delayMs);

    if (typeof this.reconnectTimer.unref === 'function') {
      this.reconnectTimer.unref();
    }
  }

  isCurrentSocket(socketToken, socket) {
    return this.activeSocketToken === socketToken && this.socket === socket;
  }

  setStatus(connectionStatus, updates = {}) {
    this.connectionStatus = connectionStatus;
    this.lastActivityAt = new Date().toISOString();

    if (Object.prototype.hasOwnProperty.call(updates, 'rawWhatsappState')) {
      this.rawWhatsappState = updates.rawWhatsappState;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'lastError')) {
      this.lastError = updates.lastError;
    }
  }
}

function extractMessageText(message, messageType) {
  if (!message || !messageType) {
    return '';
  }

  if (messageType === 'conversation') {
    return String(message.conversation || '');
  }

  if (messageType === 'extendedTextMessage') {
    return String(message.extendedTextMessage?.text || '');
  }

  if (messageType === 'imageMessage') {
    return String(message.imageMessage?.caption || '');
  }

  if (messageType === 'videoMessage') {
    return String(message.videoMessage?.caption || '');
  }

  return '';
}

function resolveContactName(contact, fallbackId) {
  const candidates = [
    contact?.name,
    contact?.notify,
    contact?.verifiedName,
    contact?.pushName,
    contact?.fullName,
    fallbackId
  ];

  for (const value of candidates) {
    const text = cleanDisplayName(value, '');
    if (text && text !== '[object Object]') {
      return text;
    }
  }

  return cleanDisplayName(fallbackId, '');
}

function isAuthorizedSender(authorizedEntries, senderIdentifiers) {
  if (!Array.isArray(authorizedEntries) || !authorizedEntries.length) {
    return false;
  }

  return authorizedEntries.some((entry) => {
    const entryIdentifiers = new Set();
    addIdentifierVariants(entryIdentifiers, entry);

    return [...entryIdentifiers].some((identifier) => senderIdentifiers.has(identifier));
  });
}

function addIdentifierVariants(target, value) {
  const raw = normalizeId(value);
  if (!raw) {
    return;
  }

  target.add(raw);

  if (raw.endsWith('@lid') || raw.endsWith('@hosted.lid')) {
    return;
  }

  const digits = normalizeNumber(raw);
  if (!digits) {
    return;
  }

  target.add(digits);
  target.add(`${digits}@c.us`);
  target.add(`${digits}@s.whatsapp.net`);
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value) {
  return String(value || '')
    .replace(/@.+$/i, '')
    .replace(/\D/g, '');
}

function isSelectableContact(contactId) {
  const normalizedId = normalizeId(contactId);

  if (!normalizedId) {
    return false;
  }

  if (normalizedId === STATUS_BROADCAST_ID || normalizedId.includes('@broadcast')) {
    return false;
  }

  return normalizedId.endsWith('@s.whatsapp.net') || normalizedId.endsWith('@c.us');
}

function cleanDisplayName(name, fallback) {
  const value = String(name || '').trim();
  return value || String(fallback || '').trim();
}

function hasMeaningfulDisplayName(name, fallbackId) {
  const value = cleanDisplayName(name, fallbackId);
  return Boolean(value && value !== String(fallbackId || '').trim() && /[\p{L}\p{N}]/u.test(value));
}

function sortByDisplayName(left, right) {
  return left.name.localeCompare(right.name, 'he', {
    sensitivity: 'base',
    numeric: true
  });
}

function dedupeById(items) {
  const seen = new Set();

  return items.filter((item) => {
    const id = normalizeId(item?.id);

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function dedupeContacts(contacts) {
  const bestByKey = new Map();

  contacts.forEach((contact) => {
    const id = normalizeId(contact?.id);
    if (!id) {
      return;
    }

    const key = normalizeNumber(id) || id;
    const current = bestByKey.get(key);

    if (!current || scoreContact(contact) > scoreContact(current)) {
      bestByKey.set(key, {
        id,
        name: cleanDisplayName(contact.name, id),
        isMyContact: Boolean(contact.isMyContact)
      });
    }
  });

  return [...bestByKey.values()];
}

function scoreContact(contact) {
  let score = 0;
  const id = normalizeId(contact?.id);
  const name = cleanDisplayName(contact?.name, id);

  if (contact?.isMyContact) {
    score += 10;
  }

  if (id.endsWith('@s.whatsapp.net') || id.endsWith('@c.us')) {
    score += 4;
  }

  if (hasMeaningfulDisplayName(name, id)) {
    score += 2;
  }

  if (name !== id) {
    score += 1;
  }

  return score;
}

function toMetadataIndex(input) {
  const index = {};

  Object.values(input || {}).forEach((metadata) => {
    const id = normalizeId(metadata?.id);
    if (id) {
      index[id] = metadata;
    }
  });

  return index;
}

function getDisconnectStatusCode(error) {
  return error?.output?.statusCode || error?.data?.statusCode || error?.statusCode || error?.cause?.output?.statusCode;
}

function formatError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    return error;
  }

  return error?.message || error?.output?.payload?.message || String(error);
}

function createDirectoryStore(logger) {
  const chatsMap = new Map();
  const store = {
    contacts: {},
    chats: {
      all() {
        return [...chatsMap.values()];
      }
    },
    bind(ev) {
      ev.on('contacts.upsert', upsertContacts);
      ev.on('contacts.update', upsertContacts);
      ev.on('chats.upsert', upsertChats);
      ev.on('chats.update', upsertChats);
      ev.on('chats.delete', deleteChats);
    },
    readFromFile(filePath) {
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      chatsMap.clear();
      Object.keys(store.contacts).forEach((key) => {
        delete store.contacts[key];
      });

      upsertContacts(payload.contacts || []);
      upsertChats(payload.chats || []);
    },
    writeToFile(filePath) {
      const payload = JSON.stringify(
        {
          contacts: Object.values(store.contacts),
          chats: store.chats.all()
        },
        null,
        2
      );

      fs.writeFileSync(filePath, `${payload}\n`, 'utf8');
    }
  };

  return store;

  function upsertContacts(entries = []) {
    for (const entry of entries || []) {
      const id = normalizeId(entry?.id);
      if (!id) {
        continue;
      }

      store.contacts[id] = {
        ...(store.contacts[id] || {}),
        ...entry,
        id
      };
    }
  }

  function upsertChats(entries = []) {
    for (const entry of entries || []) {
      const id = normalizeId(entry?.id);
      if (!id) {
        continue;
      }

      chatsMap.set(id, {
        ...(chatsMap.get(id) || {}),
        ...entry,
        id
      });
    }
  }

  function deleteChats(entries = []) {
    for (const entry of entries || []) {
      const id = normalizeId(entry?.id || entry);
      if (!id) {
        continue;
      }

      chatsMap.delete(id);
    }
  }
}

module.exports = {
  BOT_STATUS,
  WhatsAppRelayBot
};
