import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

/**
 * Teilt Text als Datei (iOS: Dateianhang im Teilen-Menü) bzw. als Textnachricht (Android).
 * Dateien landen im Cache-Ordner und werden vom System bei Bedarf geleert.
 */
export async function shareTextFile(filename: string, content: string, title: string): Promise<void> {
  if (Platform.OS === 'ios') {
    const file = new File(Paths.cache, filename);
    if (!file.exists) file.create();
    file.write(content);
    await Share.share({ url: file.uri, title });
  } else {
    await Share.share({ message: content, title });
  }
}
