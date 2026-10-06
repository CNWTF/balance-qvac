// Expo config plugin: build three Android apps from one codebase (product flavors).
//   user  -> tw.balance.qvacdemo        "Balance 本人"
//   pro   -> tw.balance.qvacdemo.pro    "Balance 專業者"
//   venue -> tw.balance.qvacdemo.venue  "Balance 場館"
// The app reads its role from the application id at runtime (expo-application).
const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins')

const FLAVORS = `
    flavorDimensions "role"
    productFlavors {
        user { dimension "role"; manifestPlaceholders = [appLabel: "Balance 本人"] }
        pro { dimension "role"; applicationIdSuffix ".pro"; manifestPlaceholders = [appLabel: "Balance 專業者"] }
        venue { dimension "role"; applicationIdSuffix ".venue"; manifestPlaceholders = [appLabel: "Balance 場館"] }
    }
`

module.exports = function withRoleFlavors(config) {
  config = withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('flavorDimensions "role"')) {
      c.modResults.contents = c.modResults.contents.replace(/android\s*\{/, (m) => m + FLAVORS)
    }
    return c
  })
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0]
    app.$['android:label'] = '${appLabel}'
    for (const a of app.activity || []) a.$['android:label'] = '${appLabel}'
    return c
  })
}
