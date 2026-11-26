const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const path = require('path');

const config = getDefaultConfig(__dirname);
// The shared packages (packages/core) live beside the app in the monorepo: watched, and resolved by name.
const packages = path.resolve(__dirname, '../../packages');
config.watchFolders = [...(config.watchFolders ?? []), packages];
// What their compiled code needs (Babel's helpers) comes from this app's node_modules: packages/ has none of its own.
config.resolver.nodeModulesPaths = [...(config.resolver.nodeModulesPaths ?? []), path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules ?? {}), '@habyss/core': path.join(packages, 'core/src') };
config.resolver.assetExts.push('pte'); // For PyTorch/ExecuTorch models
config.resolver.assetExts.push('bin'); // For MLC models

module.exports = withNativeWind(config, { input: './global.css' });