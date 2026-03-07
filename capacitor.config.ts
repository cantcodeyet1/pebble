// Capacitor config — type inlined to avoid requiring @capacitor/cli dev dependency
const config = {
  appId: 'com.pebble.app',
  appName: 'Pebble',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
  },
};

export default config;
