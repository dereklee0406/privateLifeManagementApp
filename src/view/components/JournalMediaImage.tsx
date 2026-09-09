import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { resolveMediaUri } from '../../data/mediaStore';

interface JournalMediaImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** When true, decode at a small size for grids / strips (avoids full-res re-renders). */
  thumbnail?: boolean;
}

const THUMB_DECODE_PX = 360;

/**
 * Purpose: render a persisted photo URI on native and web.
 * Inputs: stored URI (document path or halo-idb id), optional resizeMode (thumbs cover; reel contain), optional thumbnail.
 * Outputs: Image.
 * Side effects: on web, may create a blob URL from IndexedDB.
 * Design decisions: thumbnail mode passes a small decode size on iOS and uses resizeMethod on Android
 *   so month grids do not keep full camera resolution in memory.
 */
export function JournalMediaImage({
  uri,
  style,
  resizeMode = 'cover',
  thumbnail = false,
}: JournalMediaImageProps) {
  const [src, setSrc] = useState(uri);

  useEffect(() => {
    let live = true;
    void resolveMediaUri(uri).then((next) => {
      if (live) {
        setSrc(next);
      }
    });
    return () => {
      live = false;
    };
  }, [uri]);

  const source =
    thumbnail && Platform.OS === 'ios'
      ? { uri: src, width: THUMB_DECODE_PX, height: THUMB_DECODE_PX }
      : { uri: src };

  return (
    <Image
      source={source}
      resizeMode={resizeMode}
      resizeMethod={thumbnail ? 'resize' : 'auto'}
      style={[styles.image, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
