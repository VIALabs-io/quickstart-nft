/**
 * NFT Bridge Component
 * ===================
 * 
 * This component provides the interface for bridging NFTs between networks.
 * It allows users to:
 * - Select an NFT to bridge
 * - Optionally specify a recipient address
 * - Submit the bridge transaction
 */

import React, { useState } from 'react';

function NFTBridge({ 
  isConnected, 
  onBridge, 
  selectedNFT,
  isLoading,
  sourceNetwork,
  destNetwork
}) {
  // Form state
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Reset error
    setError('');
    
    // Validate form
    if (!selectedNFT) {
      setError('Please select an NFT to bridge');
      return;
    }
    
    if (!sourceNetwork) {
      setError('Please select a source network');
      return;
    }
    
    if (!destNetwork) {
      setError('Please select a destination network');
      return;
    }
    
    // Validate recipient address if provided
    if (recipient && !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setError('Please enter a valid Ethereum address (0x...)');
      return;
    }
    
    // Call the bridge function
    onBridge(selectedNFT.id, recipient);
  };
  
  return (
    <div className="bridge-nft-form">
      {isConnected ? (
        <form onSubmit={handleSubmit}>
          {/* Selected NFT display */}
          <div className="selected-nft-container">
            {selectedNFT ? (
              <div className="selected-nft">
                <h3>Selected NFT</h3>
                <div className="selected-nft-details">
                  <p><strong>ID:</strong> {selectedNFT.id}</p>
                  <p><strong>Name:</strong> {selectedNFT.name || `NFT #${selectedNFT.id}`}</p>
                </div>
              </div>
            ) : (
              <div className="no-nft-selected">
                <p>Select an NFT from your collection to bridge</p>
              </div>
            )}
          </div>
          
          {/* Recipient address input */}
          <div className="recipient-input">
            <label htmlFor="recipient">Recipient Address (optional)</label>
            <input
              type="text"
              id="recipient"
              className="address-input"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x... (leave empty to send to yourself)"
              disabled={isLoading}
            />
          </div>
          
          {/* Error message */}
          {error && (
            <div className="bridge-error-message">
              {error}
            </div>
          )}
          
          {/* Submit button */}
          <button
            type="submit"
            className="bridge-button"
            disabled={isLoading || !selectedNFT || !sourceNetwork || !destNetwork}
          >
            {isLoading ? (
              <>
                <span className="button-spinner"></span>
                Bridging...
              </>
            ) : (
              'Bridge NFT'
            )}
          </button>
        </form>
      ) : (
        <div className="connect-prompt-bridge">
          <p>Connect your wallet to bridge NFTs</p>
        </div>
      )}
    </div>
  );
}

export default NFTBridge;
