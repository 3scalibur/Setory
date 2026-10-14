const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Дозволяє імпортувати міграції Drizzle (drizzle/*.sql).
config.resolver.sourceExts.push('sql');

module.exports = config;
