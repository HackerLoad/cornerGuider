const { withInfoPlist } = require('expo/config-plugins');

/**
 * expo-live-activity setzt NSSupportsLiveActivitiesFrequentUpdates fest auf false. cornerGuider aktualisiert
 * die Live-Aktivität bei jeder neuen Kurve und im Hintergrund, dafür braucht es das höhere Update-Budget.
 */
module.exports = function withLiveActivityFrequentUpdates(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return c;
  });
};
