const app = require("./app.json");

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = () => ({
  ...app.expo,
  android: {
    ...app.expo.android,
    config: {
      ...app.expo.android.config,
      googleMaps: googleMapsApiKey ? { apiKey: googleMapsApiKey } : undefined,
    },
  },
});
