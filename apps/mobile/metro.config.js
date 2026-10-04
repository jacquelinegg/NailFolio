const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Наблюдение на кореновата папка на монорепото
config.watchFolders = [workspaceRoot];

// 2. Указване на пътищата за node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Гарантиране на правилната работа с монорепо пакети
config.resolver.disableHierarchicalLookup = true;

module.exports = config;