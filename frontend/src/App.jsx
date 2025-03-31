/**
 * Cross-Chain NFT Bridge Interface
 * ===============================
 * 
 * This is the main application component for the cross-chain NFT bridge.
 * It provides a professional bridge interface similar to popular NFT bridges,
 * allowing users to seamlessly transfer NFTs between different blockchain networks.
 * 
 * Key features:
 * - Modern, intuitive bridge UI
 * - Source and destination chain selection
 * - NFT gallery display
 * - Wallet connection
 * - Real-time NFT updates
 * - Minting and bridging capabilities
 */

import React, { useState, useEffect, useCallback } from 'react';
import WalletConnect from './components/WalletConnect.jsx';
import NFTGallery from './components/NFTGallery.jsx';
import BridgeModal from './components/BridgeModal.jsx';
import {
  connectWallet,
  switchNetwork,
  getTokenContract,
  getNetworkByChainId,
  getAllNetworks,
  listenForWalletEvents,
  mintNFT,
  bridgeNFT,
  getNFTMetadata
} from './utils/blockchain';
import {
  deploymentsExist,
  getDeploymentByChainId,
  getDeploymentErrorMessage
} from './utils/deployments';
import {
  fetchNFTsForCurrentChain,
  fetchNFTsForChain
} from './utils/nfts';
import { ethers } from 'ethers';

// Import styles
import './styles/nft.css';

function App() {
  // ======== State Management ========
  
  // Wallet state
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState(null);
  const [signer, setSigner] = useState(null);
  
  // Network state
  const [sourceNetwork, setSourceNetwork] = useState('');
  const [destNetwork, setDestNetwork] = useState('');
  
  // NFT state
  const [nftContract, setNFTContract] = useState(null);
  const [nftSymbol, setNFTSymbol] = useState('CCNFT');
  const [nfts, setNFTs] = useState({});
  const [isLoadingNFTs, setIsLoadingNFTs] = useState({});
  const [selectedNFT, setSelectedNFT] = useState(null);
  
  // Cache for providers to avoid creating new ones for each NFT check
  const [, setProviderCache] = useState({});
  
  // Cache for last fetch time to avoid too frequent fetches
  const [lastFetchTime, setLastFetchTime] = useState({});
  
  // Bridge state
  const [isBridging, setIsBridging] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  
  // Bridge modal state
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [bridgeModalData, setBridgeModalData] = useState({
    sourceNetwork: null,
    destNetwork: null,
    txHash: null,
    recipientAddress: null,
    nftId: null,
    contractAddress: null
  });
  
  // Get all available networks
  const networks = getAllNetworks();
  
  // Check if deployments exist
  const deploymentError = getDeploymentErrorMessage();
  
  // ======== NFT Management ========
  
  // Fetch NFTs for current chain
  const handleFetchNFTsForCurrentChain = useCallback(async (contract) => {
    const contractToUse = contract || nftContract;
    await fetchNFTsForCurrentChain(
      contractToUse,
      address,
      chainId,
      setNFTs,
      setIsLoadingNFTs
    );
  }, [nftContract, address, chainId]);
  
  // Fetch NFTs for a specific chain
  const handleFetchNFTsForChain = useCallback(async (targetChainId) => {
    await fetchNFTsForChain(
      address,
      targetChainId,
      chainId,
      lastFetchTime,
      setLastFetchTime,
      setNFTs,
      setIsLoadingNFTs,
      setProviderCache
    );
  }, [address, chainId, lastFetchTime]);
  
  // ======== NFT Contract ========
  
  // Initialize NFT contract
  const initNFTContract = useCallback(async (customSigner, customChainId) => {
    const signerToUse = customSigner || signer;
    const chainIdToUse = customChainId || chainId;
    
    if (!signerToUse || !chainIdToUse || !deploymentsExist()) return;
    
    const deployment = getDeploymentByChainId(chainIdToUse);
    if (!deployment) {
      console.error(`No deployment found for chain ID ${chainIdToUse}`);
      return;
    }
    
    try {
      // Create contract instance
      const contract = getTokenContract(deployment.address, signerToUse);
      setNFTContract(contract);
      
      // Set default NFT symbol immediately to avoid "Error" display
      setNFTSymbol('CCNFT');
      
      // Get NFT symbol with retry mechanism
      const getSymbol = async (retries = 3, delay = 500) => {
        for (let i = 0; i < retries; i++) {
          try {
            // Add a small delay before trying to get the symbol
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const symbol = await contract.symbol();
            setNFTSymbol(symbol);
            return symbol;
          } catch (error) {
            console.warn(`Error getting NFT symbol (attempt ${i+1}/${retries}):`, error);
            if (i === retries - 1) {
              console.error('Failed to get NFT symbol after multiple attempts');
            }
          }
        }
        return 'CCNFT'; // Default fallback
      };
      
      // Start the symbol fetch process but don't await it
      getSymbol();
      
      // Fetch NFTs
      handleFetchNFTsForCurrentChain(contract);
      
      return contract;
    } catch (error) {
      console.error('Error initializing contract:', error);
      return null;
    }
  }, [signer, chainId, handleFetchNFTsForCurrentChain]);
  
  // ======== Wallet Connection ========
  
  // Connect to wallet
  const handleConnect = useCallback(async () => {
    try {
      const { signer, address, chainId } = await connectWallet();
      setSigner(signer);
      setAddress(address);
      setChainId(chainId);
      setIsConnected(true);
      
      // Set up event listeners
      listenForWalletEvents(handleWalletEvent);
      
      // Find the network key for the current chain ID
      const network = getNetworkByChainId(chainId);
      if (network && network.key) {
        setSourceNetwork(network.key);
      }
      
      return { signer, address, chainId };
    } catch (error) {
      console.error('Connection error:', error);
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Handle wallet events
  const handleWalletEvent = useCallback(async (event) => {
    if (event.type === 'accountsChanged') {
      if (event.accounts.length === 0) {
        // User disconnected
        setIsConnected(false);
        setAddress('');
        setSigner(null);
        setNFTContract(null);
        setSelectedNFT(null);
      } else {
        // User switched accounts
        setAddress(event.accounts[0]);
        setSelectedNFT(null);
        handleConnect();
      }
    } else if (event.type === 'chainChanged') {
      // User switched networks
      const newChainId = event.chainId;
      console.log(`Chain changed to ${newChainId}, updating source network`);
      setChainId(newChainId);
      setSelectedNFT(null);
      
      if (isConnected) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await provider.getSigner();
        setSigner(newSigner);
        
        // Update source network
        const network = getNetworkByChainId(newChainId);
        if (network && network.key) {
          console.log(`Setting source network to ${network.key}`);
          setSourceNetwork(network.key);
        } else {
          console.warn(`No network found for chain ID ${newChainId}`);
        }
        
        // Initialize contract
        initNFTContract(newSigner, newChainId);
      }
    }
  }, [isConnected, handleConnect, initNFTContract]);
  
  // ======== Network Management ========
  
  // Handle source network change
  const handleSourceNetworkChange = useCallback((networkKey) => {
    // If source and dest are the same, reset dest
    if (networkKey === destNetwork) {
      setDestNetwork('');
    }
    
    // Always update the UI immediately
    setSourceNetwork(networkKey);
    setSelectedNFT(null);
    
    // If we're connected, automatically switch networks
    if (isConnected) {
      const network = networks[networkKey];
      if (network && network.chainId !== Number(chainId)) {
        // Directly switch network without confirmation
        switchNetwork(networkKey).catch(error => {
          console.error('Network switch error:', error);
          // If network switch fails, we might need to revert the UI
          const currentNetwork = getNetworkByChainId(chainId);
          if (currentNetwork && currentNetwork.key) {
            setSourceNetwork(currentNetwork.key);
          }
        });
        // We've already updated the UI, and the chainChanged event
        // will handle any further updates if needed
      }
    }
  }, [isConnected, chainId, networks, destNetwork]);
  
  // Handle destination network change
  const handleDestNetworkChange = useCallback((networkKey) => {
    setDestNetwork(networkKey);
    
    // If source and dest are the same, reset source
    if (networkKey === sourceNetwork) {
      setSourceNetwork('');
      setSelectedNFT(null);
    }
    
    // Fetch NFTs for this network
    if (isConnected && address) {
      handleFetchNFTsForChain(networks[networkKey]?.chainId);
    }
  }, [isConnected, address, networks, sourceNetwork, handleFetchNFTsForChain]);
  
  // ======== NFT Selection ========
  
  // Handle NFT selection
  const handleSelectNFT = useCallback((nft) => {
    setSelectedNFT(nft);
  }, []);
  
  // ======== NFT Minting ========
  
  // Handle NFT minting
  const handleMint = useCallback(async () => {
    if (!isConnected || !nftContract) {
      console.error('Wallet not connected');
      return;
    }
    
    setIsMinting(true);
    
    try {
      console.log('Minting new NFT...');
      const { receipt, nftId } = await mintNFT(nftContract);
      console.log(`NFT minted with ID: ${nftId}`);
      
      // Refresh NFTs
      handleFetchNFTsForCurrentChain();
      
      return { receipt, nftId };
    } catch (error) {
      console.error('Mint error:', error);
    } finally {
      setIsMinting(false);
    }
  }, [isConnected, nftContract, handleFetchNFTsForCurrentChain]);
  
  // ======== Bridge Modal ========
  
  // Function to check NFT ownership for the modal
  const checkNFTOwnership = useCallback(async (nftId) => {
    if (!bridgeModalData.destNetwork || !bridgeModalData.recipientAddress || !nftId) {
      return false;
    }
    
    const destChainId = bridgeModalData.destNetwork.chainId;
    
    try {
      // Create a provider for the destination chain
      const network = getNetworkByChainId(destChainId);
      if (!network || !network.rpcUrl) {
        throw new Error(`No RPC URL found for chain ID ${destChainId}`);
      }
      
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      // Get the contract on the destination chain
      const deployment = getDeploymentByChainId(destChainId);
      if (!deployment) {
        throw new Error(`No deployment found for chain ID ${destChainId}`);
      }
      
      const contract = getTokenContract(deployment.address, provider);
      
      // Check if the NFT exists and is owned by the recipient
      try {
        const owner = await contract.ownerOf(nftId);
        return owner.toLowerCase() === bridgeModalData.recipientAddress.toLowerCase();
      } catch (error) {
        // If the NFT doesn't exist or there's an error, return false
        return false;
      }
    } catch (error) {
      console.error('Error checking NFT ownership:', error);
      return false;
    }
  }, [bridgeModalData]);
  
  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setShowBridgeModal(false);
    // Refresh the whole page to reset the app
    window.location.reload();
  }, []);
  
  // ======== Bridge NFTs ========
  
  // Helper function to execute the bridge transaction
  const handleBridgeTransaction = useCallback(async (contract, destChainId, recipient, nftId) => {
    // Execute the bridge transaction
    setIsBridging(true);
    
    try {
      // Get source and destination network info
      const sourceChainId = Number(chainId);
      const sourceNetworkObj = getNetworkByChainId(sourceChainId);
      const destNetworkObj = getNetworkByChainId(destChainId);
      
      // Get deployment info for destination chain
      const destDeployment = getDeploymentByChainId(destChainId);
      
      // First get the transaction object before waiting for confirmation
      const tx = await contract.bridge(destChainId, recipient, nftId);
      console.log(`Bridge transaction sent: ${tx.hash}`);
      
      // Show the bridge modal immediately after transaction is sent
      setBridgeModalData({
        sourceNetwork: sourceNetworkObj,
        destNetwork: destNetworkObj,
        txHash: tx.hash,
        recipientAddress: recipient,
        nftId: nftId,
        contractAddress: destDeployment?.address
      });
      setShowBridgeModal(true);
      
      // Wait for transaction confirmation
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      
      // Find the BridgeModal component in the DOM and update its state
      const modalElement = document.querySelector('.bridge-modal');
      if (modalElement) {
        // Create a custom event to notify the BridgeModal component
        const event = new CustomEvent('sourceTransactionConfirmed');
        modalElement.dispatchEvent(event);
        
        // Also update the UI classes directly as a fallback
        const sourceStepElement = modalElement.querySelector('.status-step:first-child');
        if (sourceStepElement) {
          sourceStepElement.classList.add('completed');
          const nextStepElement = modalElement.querySelector('.status-step:nth-child(2)');
          if (nextStepElement) {
            nextStepElement.classList.add('active');
          }
        }
      }
      
      // Refresh NFTs
      handleFetchNFTsForCurrentChain();
      handleFetchNFTsForChain(destChainId);
      
      // Reset selected NFT since it's been bridged
      setSelectedNFT(null);
      
      // Log the transaction
      const destNetworkName = destNetworkObj?.name || 'destination network';
      console.log(`NFT will appear on ${destNetworkName} in 3-5 minutes`);
      
      return tx;
    } catch (error) {
      console.error('Bridge error:', error);
      setShowBridgeModal(false);
    } finally {
      setIsBridging(false);
    }
  }, [chainId, handleFetchNFTsForCurrentChain, handleFetchNFTsForChain]);
  
  // Bridge NFT between chains
  const handleBridge = useCallback(async (nftId, recipient) => {
    if (!isConnected || !nftContract) {
      console.error('Wallet not connected');
      return;
    }
    
    if (!sourceNetwork) {
      console.error('Source network not selected');
      return;
    }
    
    if (!destNetwork) {
      console.error('Destination network not selected');
      return;
    }
    
    if (!nftId) {
      console.error('No NFT selected');
      return;
    }
    
    // Get chain IDs
    const sourceChainId = networks[sourceNetwork]?.chainId;
    const destChainId = networks[destNetwork]?.chainId;
    
    if (!sourceChainId || !destChainId) {
      console.error('Invalid network selection');
      return;
    }
    
    // Check if networks are the same
    if (sourceChainId === destChainId) {
      console.error('Source and destination networks cannot be the same');
      return;
    }
    
    // Check if we're on the right network and switch if needed
    if (Number(chainId) !== Number(sourceChainId)) {
      try {
        // Automatically switch to the source network without confirmation
        await switchNetwork(sourceNetwork);
        
        // Wait a moment for the network to switch before proceeding
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // The chainChanged event will update the UI, but we need to get a new contract
        // instance for the new network before proceeding
        const provider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await provider.getSigner();
        const deployment = getDeploymentByChainId(sourceChainId);
        if (!deployment) {
          console.error(`No deployment found for chain ID ${sourceChainId}`);
          return;
        }
        const newContract = getTokenContract(deployment.address, newSigner);
        
        // Now proceed with the bridge using the new contract
        return handleBridgeTransaction(newContract, destChainId, recipient || address, nftId);
      } catch (error) {
        console.error('Network switch error:', error);
        return;
      }
    } else {
      // We're already on the right network, proceed with the bridge
      return handleBridgeTransaction(nftContract, destChainId, recipient || address, nftId);
    }
  }, [isConnected, nftContract, sourceNetwork, destNetwork, networks, chainId, address, handleBridgeTransaction]);
  
  // This function is replaced by the new handleNFTBridgeClick below
  
  // ======== Effect Hooks ========
  
  // Single effect for wallet connection and setup
  useEffect(() => {
    // Connect wallet on mount
    const setupWallet = async () => {
      try {
        // Connect wallet
        const { signer, address, chainId } = await connectWallet();
        setSigner(signer);
        setAddress(address);
        setChainId(chainId);
        setIsConnected(true);
        
        // Set up event listeners
        listenForWalletEvents(handleWalletEvent);
        
        // Find the network key for the current chain ID
        const network = getNetworkByChainId(chainId);
        if (network && network.key) {
          setSourceNetwork(network.key);
        }
        
        // Initialize contract
        if (chainId) {
          const deployment = getDeploymentByChainId(chainId);
          if (deployment) {
            const contract = getTokenContract(deployment.address, signer);
            setNFTContract(contract);
            
            // Fetch NFTs for current chain
            fetchNFTsForCurrentChain(
              contract,
              address,
              chainId,
              setNFTs,
              setIsLoadingNFTs
            );
            
            // Get NFT symbol
            try {
              const symbol = await contract.symbol();
              setNFTSymbol(symbol);
            } catch (error) {
              console.warn('Error getting NFT symbol:', error);
              setNFTSymbol('CCNFT');
            }
            
            // Fetch NFTs for all networks
            fetchAllNetworkNFTs(address, chainId);
          }
        }
      } catch (error) {
        console.log('Wallet setup failed:', error);
      }
    };
    
    // Function to fetch NFTs for all networks
    const fetchAllNetworkNFTs = async (userAddress, currentChainId) => {
      if (!userAddress) return;
      
      // Get all network chain IDs
      const networkEntries = Object.entries(networks);
      
      // Fetch NFTs for all networks
      for (const [, network] of networkEntries) {
        const targetChainId = network.chainId;
        
        // Skip the current chain as we already fetched it
        if (targetChainId === currentChainId) continue;
        
        // Fetch NFTs for this chain
        fetchNFTsForChain(
          userAddress,
          targetChainId,
          currentChainId,
          lastFetchTime,
          setLastFetchTime,
          setNFTs,
          setIsLoadingNFTs,
          setProviderCache
        );
      }
    };
    
    setupWallet();
    
    // Set up periodic NFT refresh (every 60 seconds)
    const intervalId = setInterval(() => {
      if (address && chainId) {
        // Refresh NFTs for all networks
        const networkEntries = Object.entries(networks);
        
        for (const [, network] of networkEntries) {
          const targetChainId = network.chainId;
          
          // For current chain, use the NFT contract
          if (targetChainId === chainId && nftContract) {
            fetchNFTsForCurrentChain(
              nftContract,
              address,
              chainId,
              setNFTs,
              setIsLoadingNFTs
            );
          } else {
            // For other chains, use the RPC provider
            fetchNFTsForChain(
              address,
              targetChainId,
              chainId,
              lastFetchTime,
              setLastFetchTime,
              setNFTs,
              setIsLoadingNFTs,
              setProviderCache
            );
          }
        }
      }
    }, 60000);
    
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // We're using an empty dependency array to avoid re-running this effect
  
  // ======== Render UI ========
  
  // If there's a deployment error, show error message
  if (deploymentError) {
    return (
      <div className="bridge-container">
        <div className="bridge-header">
          <h1>NFT Bridge</h1>
          <p className="powered-by">Powered by VIA Protocol</p>
        </div>
        
        <div className="error-container">
          <h2>Deployment Not Found</h2>
          <p>{deploymentError}</p>
          <p>Please run the deployment script first:</p>
          <pre>node scripts/deploy.js</pre>
          <p>This will deploy the NFT contract to the configured networks and set up cross-chain messaging.</p>
        </div>
      </div>
    );
  }
  
  // Get current network name
  const currentNetworkName = getNetworkByChainId(chainId)?.name || 'Unknown Network';
  
  // Get source and destination chain IDs
  const sourceChainId = networks[sourceNetwork]?.chainId;
  const destChainId = networks[destNetwork]?.chainId;
  
  // Get NFTs for source and destination chains
  const sourceNFTs = sourceChainId ? nfts[sourceChainId] || [] : [];
  const destNFTs = destChainId ? nfts[destChainId] || [] : [];
  
  // Check if NFTs are loading
  const isLoadingSourceNFTs = sourceChainId ? isLoadingNFTs[sourceChainId] : false;
  const isLoadingDestNFTs = destChainId ? isLoadingNFTs[destChainId] : false;
  
  // Get network names
  const sourceNetworkName = sourceNetwork ? networks[sourceNetwork]?.name : null;
  const destNetworkName = destNetwork ? networks[destNetwork]?.name : null;
  
  // Combine all NFTs from all chains into a single array
  const allNFTs = Object.entries(nfts).flatMap(([chainIdStr, chainNFTs]) => {
    const chainId = Number(chainIdStr);
    const networkInfo = getNetworkByChainId(chainId);
    return chainNFTs.map(nft => ({
      ...nft,
      networkName: networkInfo?.name || 'Unknown Network',
      networkKey: networkInfo?.key || '',
      chainId
    }));
  });

  // Handle NFT bridge button click - opens the bridge modal
  const handleNFTBridgeClick = useCallback((nft) => {
    // Set the selected NFT
    setSelectedNFT(nft);
    
    // Set source network based on the NFT's chain
    const nftNetwork = getNetworkByChainId(nft.chainId);
    if (nftNetwork && nftNetwork.key) {
      setSourceNetwork(nftNetwork.key);
      
      // If we're not already on the correct chain, switch to it
      if (Number(chainId) !== nft.chainId && isConnected) {
        switchNetwork(nftNetwork.key).catch(error => {
          console.error('Network switch error:', error);
        });
      }
    }
    
    // Show bridge modal
    setBridgeModalData({
      sourceNetwork: nftNetwork,
      destNetwork: null,
      nftId: nft.id,
      recipientAddress: address
    });
    setShowBridgeModal(true);
  }, [chainId, isConnected, address]);

  return (
    <div className="bridge-container">
      <div className="bridge-header">
        <div className="title-wrapper">
          <h1>Cross-Chain NFT Bridge</h1>
        </div>
        <div className="wallet-section">
          <WalletConnect
            isConnected={isConnected}
            address={address}
            chainId={chainId}
            networkName={currentNetworkName}
            onConnect={handleConnect}
          />
        </div>
      </div>
      
      <div className="bridge-main">
        <div className="bridge-card" style={{ maxHeight: 'fit-content' }}>
          <div className="bridge-form-container">
            <div className="bridge-intro">
              {isConnected ? (
                <button 
                  className="mint-button" 
                  onClick={handleMint}
                  disabled={isMinting}
                >
                  {isMinting ? 'Minting...' : 'Mint New NFT'}
                </button>
              ) : (
                <p>Connect your wallet to view and manage your NFTs</p>
              )}
            </div>
            
            {/* All NFTs Gallery */}
            <NFTGallery
              nfts={allNFTs}
              isLoading={Object.values(isLoadingNFTs).some(Boolean)}
              onBridge={handleNFTBridgeClick}
              showNetworkName={true}
            />
            
            <div className="bridge-footer">
              <img src="/logo-black.svg" alt="VIA Protocol" className="via-logo" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Bridge Modal */}
      <BridgeModal
        isOpen={showBridgeModal}
        onClose={handleCloseModal}
        sourceNetwork={bridgeModalData.sourceNetwork}
        destNetwork={bridgeModalData.destNetwork}
        txHash={bridgeModalData.txHash}
        recipientAddress={bridgeModalData.recipientAddress}
        nftId={bridgeModalData.nftId}
        onCheckNFTOwnership={checkNFTOwnership}
        contractAddress={bridgeModalData.contractAddress}
        onBridgeStart={(selectedDestNetwork) => {
          // Update the bridge modal data with the selected destination network
          setBridgeModalData(prev => ({
            ...prev,
            destNetwork: selectedDestNetwork
          }));
        }}
      />
    </div>
  );
}

export default App;
