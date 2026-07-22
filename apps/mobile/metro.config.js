const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Web (React 18) and mobile (React 19) share this monorepo. Force Metro to always
// resolve React/RN from the mobile app so hooks don't bind to the root React 18 copy.
const singletons = ['react', 'react-native'];
const appNodeModules = path.resolve(projectRoot, 'node_modules');

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...Object.fromEntries(
    singletons.map((name) => [name, path.join(appNodeModules, name)])
  ),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName === 'react/jsx-dev-runtime' ||
    moduleName === 'react-native'
  ) {
    return {
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
