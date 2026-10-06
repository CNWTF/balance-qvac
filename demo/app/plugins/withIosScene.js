// Expo config plugin: adopt the UIScene life cycle so the app launches when built with the iOS 27 SDK.
// Replaces the generated AppDelegate.swift with ios-patches/AppDelegate.swift (AppDelegate + SceneDelegate)
// and declares a scene manifest in Info.plist. Remove once Expo ships UIScene support for this SDK.
const fs = require('fs')
const path = require('path')
const { withDangerousMod, withInfoPlist } = require('expo/config-plugins')

module.exports = function withIosScene(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate'
        }]
      }
    }
    return c
  })
  return withDangerousMod(config, ['ios', async (c) => {
    const projectName = c.modRequest.projectName
    const target = path.join(c.modRequest.platformProjectRoot, projectName, 'AppDelegate.swift')
    const patch = path.join(c.modRequest.projectRoot, 'ios-patches', 'AppDelegate.swift')
    fs.copyFileSync(patch, target)
    return c
  }])
}
