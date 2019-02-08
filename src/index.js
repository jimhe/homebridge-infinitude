const { pluginName, platformName } = require('./constants');
const InfinitudePlatform = require('./InfinitudePlatform');

module.exports = homebridge => {
  homebridge.registerPlatform(pluginName, platformName, InfinitudePlatform, true);
};
