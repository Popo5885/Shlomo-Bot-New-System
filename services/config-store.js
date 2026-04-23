const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  TRIGGER_GROUP_ID: '',
  AUTHORIZED_NUMBERS: [],
  TARGET_GROUP_IDS: [],
  POST_TO_STATUS: false
};

class ConfigStore {
  constructor(configPath = path.join(__dirname, '..', 'config.json')) {
    this.configPath = configPath;
  }

  async ensureConfigFile() {
    try {
      await fs.promises.access(this.configPath, fs.constants.F_OK);
    } catch {
      await this.writeConfig(DEFAULT_CONFIG);
    }
  }

  async readConfig() {
    await this.ensureConfigFile();

    try {
      const raw = await fs.promises.readFile(this.configPath, 'utf8');
      return sanitizeConfig(JSON.parse(raw));
    } catch (error) {
      console.error('[Config] Failed to read config.json, restoring defaults.', error);
      await this.writeConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
  }

  async writeConfig(nextConfig) {
    const sanitized = sanitizeConfig(nextConfig);
    const payload = JSON.stringify(sanitized, null, 2);
    await fs.promises.writeFile(this.configPath, `${payload}\n`, 'utf8');
    return sanitized;
  }
}

function sanitizeConfig(input = {}) {
  return {
    TRIGGER_GROUP_ID: cleanString(input.TRIGGER_GROUP_ID),
    AUTHORIZED_NUMBERS: cleanArray(input.AUTHORIZED_NUMBERS),
    TARGET_GROUP_IDS: cleanArray(input.TARGET_GROUP_IDS),
    POST_TO_STATUS: coerceBoolean(input.POST_TO_STATUS)
  };
}

function cleanArray(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\r\n,]+/);

  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function cleanString(value) {
  return String(value || '').trim();
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'on', 'yes'].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

module.exports = {
  ConfigStore,
  DEFAULT_CONFIG,
  sanitizeConfig
};
