const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('pte'); // For PyTorch/ExecuTorch models
config.resolver.assetExts.push('bin'); // For MLC models

module.exports = withNativeWind(config, { input: './global.css' });