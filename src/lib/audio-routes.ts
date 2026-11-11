/** Control visibility only; playback routing remains in the audio provider. */
export function showAudioControl(pathname: string, musicEnabled: boolean): boolean {
  if (/^\/(capture|scan|spawn)(\b|\/|$)/i.test(pathname)) return false;
  if (/^\/(print|qr-generator|field-qr|privacy|terms|reset-password)(\b|\/|$)/i.test(pathname)) return musicEnabled;
  return true;
}