import { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * A hook that globally monitors the device's network connectivity status.
 * @returns {boolean} true if the device is connected to the internet, false otherwise.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true); // Assume online initially to prevent false offline blocking

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isConnected is a boolean indicating if there is an active network connection
      // isInternetReachable is a boolean indicating if we can actually reach the internet
      // (isInternetReachable can be null initially, so we check for strict false)
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    // Check the initial state right away
    NetInfo.fetch().then((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    return () => {
      // Cleanup subscription
      unsubscribe();
    };
  }, []);

  return isOnline;
}
