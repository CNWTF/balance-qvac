#!/bin/zsh
# Build Balance Agent (Release) and install it on the connected iPhone. Run in Terminal on this Mac.
set -e
export PATH=/opt/homebrew/bin:$PATH
export LANG=en_US.UTF-8
UDID=00008160-001C03EA3A800036
cd ~/qvac-demo/balance-app
xcodebuild -workspace ios/BalanceAgent.xcworkspace -scheme BalanceAgent -configuration Release   -destination "id=$UDID" -derivedDataPath build -allowProvisioningUpdates   DEVELOPMENT_TEAM=94RY9N46FJ CODE_SIGN_STYLE=Automatic > ~/qvac-demo/build_ios.log 2>&1   || { echo 'BUILD FAILED, see ~/qvac-demo/build_ios.log'; tail -20 ~/qvac-demo/build_ios.log; exit 1; }
echo 'BUILD SUCCEEDED, installing...'
xcrun devicectl device install app --device $UDID build/Build/Products/Release-iphoneos/BalanceAgent.app
xcrun devicectl device process launch --device $UDID tw.balance.qvacdemo || echo 'Installed. Open "Balance Agent" on the iPhone (first time: Settings > General > VPN & Device Management > trust the developer).'
echo DONE
