/**
 * NFT Gallery Component
 * ====================
 * 
 * This component displays a collection of NFTs for a specific chain.
 * It handles loading states, empty states, and provides options to
 * mint new NFTs or bridge existing ones.
 */

import React from 'react';
import NFTCard from './NFTCard';

function NFTGallery({ 
  nfts = [], 
  isLoading = false, 
  networkName, 
  onBridge,
  onMint,
  selectedNFT,
  onSelectNFT,
  selectable = false,
  showBridgeButtons = true,
  showNetworkName = false
}) {
  // Handle mint button click
  const handleMintClick = () => {
    if (onMint) onMint();
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="nft-gallery loading">
        <div className="loading-spinner"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }
  
  // Empty state
  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-gallery empty">
        <div className="empty-state-icon">🖼️</div>
        <p>No NFTs found on {networkName || 'this network'}.</p>
        {onMint && (
          <button className="mint-button" onClick={handleMintClick}>
            <span className="mint-icon">+</span>
            Mint New NFT
          </button>
        )}
      </div>
    );
  }
  
  // Get chain logo URL
  const getChainLogo = (chainId) => {
    return chainId ? `https://scan.vialabs.io/images/logos/chains/${chainId}.png` : null;
  };
  
  // Extract chain ID from network name if available
  const chainId = networkName && !isNaN(parseInt(networkName)) ? parseInt(networkName) : null;
  const chainLogo = getChainLogo(chainId);
  
  // Render gallery
  return (
    <div className="nft-gallery">
      <div className="nft-gallery-header">
        <div className="gallery-title">
          {chainLogo && (
            <img 
              src={chainLogo} 
              alt={networkName} 
              className="network-logo-small"
            />
          )}
        </div>
        
        {onMint && (
          <button className="mint-button" onClick={handleMintClick} aria-label="Mint a new NFT">
            <span className="mint-icon">+</span>
            Mint New NFT
          </button>
        )}
      </div>
      
      <div className="nft-grid">
        {nfts.map(nft => (
          <NFTCard
            key={`${nft.chainId}-${nft.id}`}
            nft={nft}
            onBridge={onBridge}
            isSelected={selectedNFT && selectedNFT.id === nft.id}
            onSelect={onSelectNFT}
            selectable={selectable}
            showBridgeButton={showBridgeButtons}
            networkName={showNetworkName ? nft.networkName : networkName}
          />
        ))}
      </div>
    </div>
  );
}

export default NFTGallery;
