// Ship .gguf model files as app assets (the image classifier's weights are not included in QVAC's mobile worker bundle).
const { getDefaultConfig } = require('expo/metro-config')
const config = getDefaultConfig(__dirname)
config.resolver.assetExts.push('gguf')
module.exports = config
