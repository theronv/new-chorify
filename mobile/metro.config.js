const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

// Shim react-dom for @clerk/clerk-react (not available in React Native)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    return {
      filePath: path.resolve(__dirname, 'react-dom-shim.js'),
      type: 'sourceFile',
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
