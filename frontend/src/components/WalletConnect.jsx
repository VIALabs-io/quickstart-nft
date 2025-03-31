/**
 * WalletConnect Component
 * =======================
 * 
 * This component handles the wallet connection functionality.
 * It displays:
 * - A connect button when not connected
 * - Wallet information when connected (address and network)
 * - Provides a clear visual indication of connection status
 * - Disconnect button for easy wallet disconnection
 * 
 * The component is designed to be compact and fit in the header of the bridge interface.
 */

import React, { memo, useMemo } from 'react';

const WalletConnect = memo(({ isConnected, address, chainId, networkName, onConnect }) => {
  // Format the address for display (show first 6 and last 4 characters)
  const formattedAddress = useMemo(() => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);
  
  // Handle disconnect
  const handleDisconnect = () => {
    // Disconnect wallet by refreshing the page
    // This is a simple approach that works with most wallet providers
    window.location.reload();
  };
  
  // Render connect button or wallet info
  if (!isConnected) {
    return (
      <div className="wallet-connect-container">
        <button className="connect-wallet-button" onClick={onConnect}>
          Connect Wallet
        </button>
      </div>
    );
  }
  
  return (
    <div className="wallet-connect-container">
      <div className="wallet-connected">
        <div className="wallet-info">
          <div className="wallet-details">
            <span className="connection-indicator"></span>
            <span className="wallet-address">{formattedAddress}</span>
            <span className="network-separator">•</span>
            <span className="network-name-display">{networkName}</span>
          </div>
        </div>
        <button 
          className="disconnect-button" 
          onClick={handleDisconnect}
          aria-label="Disconnect wallet"
        >
          <span className="disconnect-icon">×</span>
        </button>
      </div>
    </div>
  );
});

export default WalletConnect;
