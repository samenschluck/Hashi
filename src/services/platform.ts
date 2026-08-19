import { Capacitor } from '@capacitor/core';

/**
 * Laeuft die App als native Android-App oder im Browser?
 *
 * Alle Service-Wrapper fragen ueber diese Stelle, damit die App im Browser
 * vollstaendig entwickelbar bleibt und ein spaeteres iOS-Ziel nichts umbauen muss.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Plattformname: 'android', 'ios' oder 'web'. */
export function platformName(): string {
  return Capacitor.getPlatform();
}
