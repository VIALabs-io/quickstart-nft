/**
 * NFT Card Component
 * =================
 * 
 * This component displays a single NFT with its metadata and provides
 * options to bridge it to another chain.
 */

import React from 'react';

function NFTCard({ 
  nft, 
  onBridge, 
  isSelected, 
  onSelect, 
  selectable = false,
  showBridgeButton = true,
  networkName
}) {
  if (!nft) return null;
  
  // Format the minted date
  const mintDate = nft.mintedAt ? new Date(nft.mintedAt * 1000).toLocaleDateString() : 'Unknown';
  
  // Handle bridge button click
  const handleBridgeClick = (e) => {
    e.stopPropagation();
    if (onBridge) onBridge(nft);
  };
  
  // Handle card click for selection
  const handleCardClick = () => {
    if (selectable && onSelect) onSelect(nft);
  };

  // Get chain logo URL
  const getChainLogo = (chainId) => {
    return chainId ? `https://scan.vialabs.io/images/logos/chains/${chainId}.png` : null;
  };
  
  // Extract chain ID from origin chain if available
  const originChainId = nft.originChainId || (nft.originChain && !isNaN(parseInt(nft.originChain)) ? parseInt(nft.originChain) : null);
  const originChainLogo = getChainLogo(originChainId);
  
  return (
    <div 
      className={`nft-card ${isSelected ? 'selected' : ''} ${selectable ? 'selectable' : ''}`}
      onClick={handleCardClick}
      role={selectable ? "button" : undefined}
      aria-pressed={selectable && isSelected ? "true" : undefined}
    >
      <div className="nft-image-container">
        <img 
          src={nft.image || 'https://i.postimg.cc/FKkpPByb/cl-logo.png'} 
          alt={nft.name || `NFT #${nft.id}`} 
          className="nft-image"
          loading="lazy"
        />
        {/* Network badge removed as requested */}
      </div>
      
      <div className="nft-details">
        <h3 className="nft-name">{nft.name || `NFT #${nft.id}`}</h3>
        
        <div className="nft-info">
          <div className="nft-info-item">
            <span className="nft-info-label">ID:</span>
            <span className="nft-info-value">{nft.id}</span>
          </div>
          
          <div className="nft-info-item origin-chain">
            <span className="nft-info-label">Origin:</span>
            <span className="nft-info-value">
              {originChainLogo && (
                <img 
                  src={originChainLogo} 
                  alt={nft.originChain || 'Unknown'} 
                  className="chain-logo"
                />
              )}
              {nft.originChain || 'Unknown'}
            </span>
          </div>
          
          {networkName && (
            <div className="nft-info-item current-chain">
              <span className="nft-info-label">Current:</span>
              <span className="nft-info-value">
                {nft.chainId ? (
                  <img 
                    src={getChainLogo(nft.chainId)} 
                    alt={String(nft.chainId)} 
                    className="chain-logo"
                  />
                ) : networkName && !isNaN(parseInt(networkName)) ? (
                  <img 
                    src={getChainLogo(parseInt(networkName))} 
                    alt={networkName} 
                    className="chain-logo"
                  />
                ) : null}
                {nft.chainId ? nft.chainId : (!isNaN(parseInt(networkName)) ? parseInt(networkName) : networkName)}
              </span>
            </div>
          )}
          
          <div className="nft-info-item">
            <span className="nft-info-label">Minted:</span>
            <span className="nft-info-value">{mintDate}</span>
          </div>
        </div>
        
        {showBridgeButton && onBridge && (
          <button 
            className="nft-bridge-button" 
            onClick={handleBridgeClick}
            aria-label={`Bridge NFT #${nft.id} to another chain`}
          >
            <span className="bridge-icon">↗</span>
            Bridge NFT
          </button>
        )}
      </div>
    </div>
  );
}

export default NFTCard;
