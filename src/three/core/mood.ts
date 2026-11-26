/**
 * Scene mood, set by createStage() from the host section before a scene builds its props:
 * light (mist band, daylight arch-vis) or dark (navy band, night-shift digital twin).
 * Kept in its own module so stage.ts and kit.ts can both use it without importing each other.
 */
let darkMood = false;

export const setMood = (dark: boolean) => {
  darkMood = dark;
};

export const isDark = () => darkMood;
