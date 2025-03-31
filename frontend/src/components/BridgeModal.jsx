/**
 * NFT Bridge Transaction Modal Component
 * =====================================
 * 
 * This component displays a modal overlay that shows the status of an NFT bridge transaction.
 * It tracks the progress of the transaction through different states:
 * 1. Confirming source transaction
 * 2. Waiting for destination chain
 * 3. Success
 * 
 * It also provides links to explorers for both source and destination chains.
 */

import React, { useState, useEffect } from 'react';
import { getAllNetworks, switchNetwork, bridgeNFT, getTokenContract, getNetworkByChainId } from '../utils/blockchain';
import { getDeploymentByChainId } from '../utils/deployments';
import { ethers } from 'ethers';

function BridgeModal({ 
  isOpen, 
  onClose, 
  sourceNetwork, 
  destNetwork, 
  txHash: propTxHash, 
  recipientAddress,
  nftId,
  onCheckNFTOwnership,
  contractAddress,
  onBridgeStart
}) {
  const [selectedDestNetwork, setSelectedDestNetwork] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [bridgeInProgress, setBridgeInProgress] = useState(false);
  // Local state for transaction hash
  const [localTxHash, setLocalTxHash] = useState(propTxHash);
  // Transaction states
  const [status, setStatus] = useState('confirming-source');
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [destConfirmed, setDestConfirmed] = useState(false);
  
  // NFT ownership tracking
  const [nftReceived, setNftReceived] = useState(false);
  const [sourceConfirmTime, setSourceConfirmTime] = useState(null);
  
  // Effect to check NFT ownership periodically
  useEffect(() => {
    if (!isOpen || !sourceConfirmed || !nftId) return;
    
    // If source is confirmed but destination is not, start checking NFT ownership
    const intervalId = setInterval(async () => {
      if (onCheckNFTOwnership) {
        // Only start checking after source transaction has been confirmed for at least 10 seconds
        // This gives time for the bridge process to begin
        const now = Date.now();
        if (sourceConfirmTime && (now - sourceConfirmTime < 10000)) {
          console.log("Waiting for bridge process to begin...");
          return;
        }
        
        const isOwned = await onCheckNFTOwnership(nftId);
        
        // If NFT is now owned by the recipient, mark destination as confirmed
        if (isOwned) {
          setNftReceived(true);
          setDestConfirmed(true);
          setStatus('success');
          clearInterval(intervalId);
        }
      }
    }, 5000); // Check every 5 seconds for more responsive feedback
    
    return () => clearInterval(intervalId);
  }, [isOpen, sourceConfirmed, nftId, onCheckNFTOwnership]);
  
  // Update local txHash when prop changes
  useEffect(() => {
    setLocalTxHash(propTxHash);
  }, [propTxHash]);

  // Effect to update status when source is confirmed
  useEffect(() => {
    if (sourceConfirmed && !destConfirmed) {
      setStatus('waiting-destination');
      setSourceConfirmTime(Date.now());
    }
  }, [sourceConfirmed, destConfirmed]);
  
  // Load available networks for destination selection
  useEffect(() => {
    if (isOpen && sourceNetwork && !localTxHash) {
      const networks = getAllNetworks();
      const networkList = Object.entries(networks).map(([key, network]) => ({
        key,
        ...network
      })).filter(network => network.chainId !== sourceNetwork.chainId);
      
      setAvailableNetworks(networkList);
      
      // If destNetwork is already set, use it as the selected network
      if (destNetwork) {
        setSelectedDestNetwork(destNetwork);
      } else if (networkList.length > 0) {
        // Otherwise select the first available network
        setSelectedDestNetwork(networkList[0]);
      }
    }
  }, [isOpen, sourceNetwork, destNetwork]);

  // Effect to listen for the custom event from App.js
  useEffect(() => {
    if (!isOpen) return;
    
    const modalElement = document.querySelector('.bridge-modal');
    if (!modalElement) return;
    
    const handleSourceConfirmed = () => {
      setSourceConfirmed(true);
      setStatus('waiting-destination');
    };
    
    modalElement.addEventListener('sourceTransactionConfirmed', handleSourceConfirmed);
    
    return () => {
      modalElement.removeEventListener('sourceTransactionConfirmed', handleSourceConfirmed);
    };
  }, [isOpen]);
  
  // Handle destination network selection
  const handleDestNetworkChange = (e) => {
    const networkKey = e.target.value;
    const selectedNetwork = availableNetworks.find(network => network.key === networkKey);
    setSelectedDestNetwork(selectedNetwork);
  };
  
  // Handle network card selection
  const handleNetworkCardSelect = (network) => {
    setSelectedDestNetwork(network);
  };
  
  // Error state
  const [errorMessage, setErrorMessage] = useState('');
  
  // Handle bridge button click
  const handleBridge = async () => {
    if (!sourceNetwork || !selectedDestNetwork || !nftId || bridgeInProgress) return;
    
    setBridgeInProgress(true);
    setErrorMessage('');
    
    try {
      // Notify parent component about the selected destination network
      if (onBridgeStart) {
        onBridgeStart(selectedDestNetwork);
      }
      
      // Make sure we're on the correct source chain
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const chainId = await provider.getNetwork().then(network => network.chainId);
        
        // If we're not on the correct chain, switch to it
        if (Number(chainId) !== sourceNetwork.chainId) {
          await switchNetwork(sourceNetwork.key);
          // Wait for network switch
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Get signer and contract
        const signer = await provider.getSigner();
        const deployment = getDeploymentByChainId(sourceNetwork.chainId);
        if (!deployment) {
          throw new Error(`No deployment found for chain ID ${sourceNetwork.chainId}`);
        }
        
        const contract = getTokenContract(deployment.address, signer);
        
        // Execute the bridge transaction
        const tx = await contract.bridge(
          selectedDestNetwork.chainId, 
          recipientAddress, 
          nftId
        );
        
        console.log(`Bridge transaction sent: ${tx.hash}`);
        
        // Update the UI to show transaction in progress
        setStatus('confirming-source');
        
        // Update txHash in the component state to trigger the UI change
        // This is important - it switches the modal to transaction progress view
        setLocalTxHash(tx.hash);
        
        // Wait for transaction confirmation
        console.log('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Update status
        setSourceConfirmed(true);
        setStatus('waiting-destination');
        setSourceConfirmTime(Date.now());
      }
    } catch (error) {
      console.error('Bridge error:', error);
      setErrorMessage(error.message || 'Failed to bridge NFT');
      setBridgeInProgress(false);
    }
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  // Get chain logo URLs
  const sourceChainId = sourceNetwork?.chainId;
  const destChainId = destNetwork?.chainId;
  const sourceLogoUrl = sourceChainId ? `https://scan.vialabs.io/images/logos/chains/${sourceChainId}.png` : null;
  const destLogoUrl = destChainId ? `https://scan.vialabs.io/images/logos/chains/${destChainId}.png` : null;
  
  // Generate explorer URLs
  const viaExplorerUrl = localTxHash ? `https://scan.vialabs.io/transaction/${localTxHash}` : null;
  const sourceExplorerUrl = sourceNetwork?.blockExplorer && localTxHash ? `${sourceNetwork.blockExplorer}/tx/${localTxHash}` : null;
  const destAddressExplorerUrl = destNetwork?.blockExplorer && recipientAddress ? 
    `${destNetwork.blockExplorer}/address/${recipientAddress}` : null;
  const destNFTExplorerUrl = destNetwork?.blockExplorer && contractAddress ? 
    `${destNetwork.blockExplorer}/token/${contractAddress}` : null;
  
  return (
    <div className="bridge-modal-overlay">
      <div className="bridge-modal">
        <div className="bridge-modal-header">
          <h3>Bridge Transaction Status</h3>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="bridge-modal-content">
          {/* Networks display */}
          {localTxHash ? (
            /* Transaction in progress - show source and destination networks horizontally */
            <div className="bridge-networks-row">
              <div className="bridge-network source">
                <div className="network-logo">
                  {sourceLogoUrl ? (
                    <img src={sourceLogoUrl} alt={sourceNetwork?.name} />
                  ) : (
                    <div className="network-logo-placeholder">{sourceNetwork?.name?.charAt(0)}</div>
                  )}
                </div>
              </div>
              
              <div className="bridge-direction horizontal">→</div>
              
              <div className="bridge-network destination">
                <div className="network-logo">
                  {destLogoUrl ? (
                    <img src={destLogoUrl} alt={destNetwork?.name} />
                  ) : (
                    <div className="network-logo-placeholder">{destNetwork?.name?.charAt(0)}</div>
                  )}
                </div>
              </div>
              
              <div className="nft-id-display">
                <span>NFT ID: {nftId}</span>
              </div>
            </div>
          ) : (
            /* No transaction yet - show network selection */
            <div className="bridge-setup">
              <div className="bridge-networks-column">
                {/* Source Network as a card */}
                <div className="bridge-network-select source-network-display">
                  <label>Source</label>
                  <div className="network-card selected non-interactive">
                    <div className="network-card-logo">
                      {sourceLogoUrl ? (
                        <img src={sourceLogoUrl} alt={sourceNetwork?.name} />
                      ) : (
                        <div className="network-logo-placeholder">{sourceNetwork?.name?.charAt(0)}</div>
                      )}
                    </div>
                    <div className="network-card-name">{sourceNetwork?.name}</div>
                  </div>
                </div>
                
                <div className="bridge-direction">↓</div>
                
                {/* Destination Network Selection */}
                <div className="bridge-network-select">
                  <label htmlFor="destination-network">Destination</label>
                  
                  {/* Visual network card selector */}
                  <div className="network-cards-container">
                    {availableNetworks.map(network => {
                      const isSelected = selectedDestNetwork?.key === network.key;
                      const networkLogoUrl = network.chainId ? 
                        `https://scan.vialabs.io/images/logos/chains/${network.chainId}.png` : null;
                      
                      return (
                        <div 
                          key={network.key}
                          className={`network-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleNetworkCardSelect(network)}
                          role="button"
                          aria-pressed={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleNetworkCardSelect(network);
                            }
                          }}
                        >
                          <div className="network-card-logo">
                            {networkLogoUrl ? (
                              <img src={networkLogoUrl} alt={network.name} />
                            ) : (
                              <div className="network-logo-placeholder">{network.name.charAt(0)}</div>
                            )}
                          </div>
                          <div className="network-card-name">{network.name}</div>
                          {isSelected && <div className="network-card-check">✓</div>}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Fallback select for accessibility */}
                  <select 
                    id="destination-network" 
                    value={selectedDestNetwork?.key || ''}
                    onChange={handleDestNetworkChange}
                    className="network-select-fallback"
                    aria-label="Select destination network"
                  >
                    {availableNetworks.map(network => (
                      <option key={network.key} value={network.key}>
                        {network.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* Simplified NFT Information - only show NFT ID when not in bridge process */}
          {nftId && !localTxHash && (
            <div className="nft-id-display pre-bridge">
              <span>NFT ID: {nftId}</span>
            </div>
          )}
          
          {/* Status steps - only show when a transaction is in progress */}
          {localTxHash && (
            <div className="bridge-status-steps">
              <div className={`status-step ${status === 'confirming-source' ? 'active' : ''} ${sourceConfirmed ? 'completed' : ''}`}>
                <div className="step-indicator">
                  {sourceConfirmed ? '✓' : '1'}
                </div>
                <div className="step-content">
                  <div className="step-title">Confirming Source Transaction</div>
                  <div className="step-description">
                    {sourceConfirmed 
                      ? 'NFT burned on source chain' 
                      : 'Waiting for transaction confirmation...'}
                  </div>
                </div>
              </div>
              
              <div className={`status-step ${status === 'waiting-destination' ? 'active' : ''} ${destConfirmed ? 'completed' : ''}`}>
                <div className="step-indicator">
                  {destConfirmed ? '✓' : status === 'waiting-destination' ? (
                    <div className="spinner-icon">⟳</div>
                  ) : '2'}
                </div>
                <div className="step-content">
                  <div className="step-title">Waiting for Destination Chain</div>
                  <div className="step-description">
                    {destConfirmed 
                      ? 'NFT received on destination chain' 
                      : sourceConfirmed 
                        ? 'Waiting for NFT to arrive on destination chain...' 
                        : 'Waiting for source transaction to confirm first...'}
                  </div>
                </div>
              </div>
              
              <div className={`status-step ${status === 'success' ? 'active' : ''}`}>
                <div className="step-indicator">
                  {destConfirmed ? '✓' : ''}
                </div>
                <div className="step-content">
                  <div className="step-title">Bridge Complete</div>
                  <div className="step-description">
                    {destConfirmed 
                      ? 'NFT bridge completed successfully!' 
                      : 'Waiting for previous steps to complete...'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Explorer links */}
          {(sourceConfirmed || destConfirmed) && (
            <div className="bridge-explorer-links">
              <h4>Transaction Details</h4>
              
              {viaExplorerUrl && (
                <a 
                  href={viaExplorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="explorer-link"
                >
                  View on VIA Explorer
                </a>
              )}
              
              {sourceExplorerUrl && (
                <a 
                  href={sourceExplorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="explorer-link"
                >
                  View Source Transaction
                </a>
              )}
              
              {destAddressExplorerUrl && destConfirmed && (
                <a 
                  href={destAddressExplorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="explorer-link"
                >
                  View Recipient on Destination Chain
                </a>
              )}
              
              {destNFTExplorerUrl && destConfirmed && (
                <a 
                  href={destNFTExplorerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="explorer-link"
                >
                  View NFT Contract on Destination Chain
                </a>
              )}
            </div>
          )}
        </div>
        
        <div className="bridge-modal-footer">
          {localTxHash ? (
            destConfirmed ? (
              <button className="bridge-modal-button success" onClick={onClose}>
                Close
              </button>
            ) : (
              <div className="bridge-modal-status">
                {status === 'confirming-source' && 'Confirming transaction...'}
                {status === 'waiting-destination' && 'Waiting for NFT to arrive...'}
              </div>
            )
          ) : (
            <button 
              className="bridge-modal-button primary" 
              onClick={handleBridge}
              disabled={!selectedDestNetwork || bridgeInProgress}
            >
              {bridgeInProgress ? 'Bridging...' : 'Bridge NFT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BridgeModal;
