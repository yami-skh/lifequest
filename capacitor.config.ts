import type { CapacitorConfig } from '@capacitor/cli';

// Сборка APK: тот же веб-код из dist/, упакованный в Android-приложение.
const config: CapacitorConfig = {
  appId: 'io.github.yamiskh.lifequest',
  appName: 'LifeQuest',
  webDir: 'dist',
  backgroundColor: '#0E1015',
  android: {
    backgroundColor: '#0E1015',
  },
};

export default config;
