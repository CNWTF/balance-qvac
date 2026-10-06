#!/bin/zsh
# Build the three Balance apps (personal / professional / venue) and install them on the connected iPhone.
# Run in Terminal on the Mac (code signing needs the logged-in keychain). Usage: ~/qvac-demo/build_and_install_all.sh [user|pro|venue ...]
set -e
export PATH=/opt/homebrew/bin:$PATH
export LANG=en_US.UTF-8
UDID=00008160-001C03EA3A800036
TEAM=94RY9N46FJ
APP_DIR=~/qvac-demo/balance-app
PLIST=$APP_DIR/ios/Balance/Info.plist
if (( $# )); then ROLES=("$@"); else ROLES=(user pro venue); fi  # zsh does not word-split ${@:-...}
cd $APP_DIR
cp $PLIST /tmp/Balance.Info.plist.bak
trap 'cp /tmp/Balance.Info.plist.bak $PLIST' EXIT

for ROLE in $ROLES; do
  case $ROLE in
    user)  BID=tw.balance.qvacdemo;       NAME="Balance 本人" ;;
    pro)   BID=tw.balance.qvacdemo.pro;   NAME="Balance 專業者" ;;
    venue) BID=tw.balance.qvacdemo.venue; NAME="Balance 場館" ;;
    *) echo "unknown role $ROLE"; exit 1 ;;
  esac
  echo "=== $ROLE ($BID) ==="
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName '$NAME'" $PLIST
  xcodebuild -workspace ios/Balance.xcworkspace -scheme Balance -configuration Release \
    -destination "id=$UDID" -derivedDataPath build -allowProvisioningUpdates \
    DEVELOPMENT_TEAM=$TEAM CODE_SIGN_STYLE=Automatic PRODUCT_BUNDLE_IDENTIFIER=$BID > ~/qvac-demo/build_ios_$ROLE.log 2>&1 \
    || { echo "BUILD FAILED ($ROLE), see ~/qvac-demo/build_ios_$ROLE.log"; tail -20 ~/qvac-demo/build_ios_$ROLE.log; exit 1; }
  xcrun devicectl device install app --device $UDID build/Build/Products/Release-iphoneos/Balance.app | tail -2
  cp /tmp/Balance.Info.plist.bak $PLIST
done
echo "DONE. Open the apps on the iPhone (first time: Settings > General > VPN & Device Management > trust the developer)."
