// Ask for camera / photo permission before opening the picker (iOS rejects the call otherwise).
import * as ImagePicker from 'expo-image-picker'

export async function pickImage(camera: boolean, quality = 0.8) {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) throw new Error(camera ? '沒有相機權限 · Camera permission denied' : '沒有相簿權限 · Photo library permission denied')
  const r = camera ? await ImagePicker.launchCameraAsync({ quality }) : await ImagePicker.launchImageLibraryAsync({ quality, mediaTypes: ['images'] })
  return r.canceled ? null : r.assets[0].uri
}
