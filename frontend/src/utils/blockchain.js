/**
 * Blockchain Utility Functions
 * ============================
 * 
 * This module provides utility functions for interacting with the blockchain:
 * - Wallet connection and management
 * - Network switching
 * - Contract interaction
 * - NFT operations (minting, bridging)
 * 
 * It dynamically loads network configurations from the deployments.json file,
 * ensuring that the frontend automatically detects new networks when they're added.
 * 
 * NFT collection management functions are imported from nfts.js to avoid duplication.
 */

import { ethers } from 'ethers';

// Import deployments directly for Vite
import deploymentsJson from '../config/deployments.json';

// Import NFT utility functions
import {
  fetchNFTsForCurrentChain,
  fetchNFTsForChain,
  refreshNFTs,
  getNFTCountForChain,
  getNFTById,
  getNFTMetadata,
  getNFTsWithMetadata,
  getNFTsByOwner,
  setupDependencies
} from './nfts';

// Re-export NFT utility functions
export {
  fetchNFTsForCurrentChain,
  fetchNFTsForChain,
  refreshNFTs,
  getNFTCountForChain,
  getNFTById,
  getNFTMetadata,
  getNFTsWithMetadata,
  getNFTsByOwner
};

// Network configurations - dynamically loaded from deployments.json
let networks = {};

/**
 * Load network configurations from deployments
 * This ensures the frontend automatically detects new networks when they're added
 */
// Create network configurations from deployments
Object.entries(deploymentsJson).forEach(([chainId, deployment]) => {
  const chainIdNum = parseInt(chainId);
  const networkKey = deployment.network; // Use the full network name (e.g., 'avalanche-testnet')
  
  networks[networkKey] = {
    name: deployment.network,
    chainId: chainIdNum,
    // Use the RPC URL from the deployment if available
    rpcUrl: deployment.rpcUrl || '',
    // Use the block explorer from the deployment if available
    blockExplorer: deployment.blockExplorer || ''
  };
});

console.log(`Loaded ${Object.keys(networks).length} networks from deployments`);

// Initialize the nfts.js module with the necessary functions
// This avoids circular dependencies
setupDependencies(getTokenContract, getNetworkByChainId);

/**
 * ABI for the MyNFT contract
 * This includes all the functions and events we need to interact with the NFT contract
 */
const nftABI = [
  // Basic ERC721 functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  
  // Custom NFT functions
  "function mint() returns (uint256)",
  "function getTokensByOwner(address) view returns (uint256[])",
  "function getTokensWithMetadata(address) view returns (uint256[], tuple(string,string,string,uint256,uint256)[])",
  "function getTokenMetadata(uint256) view returns (tuple(string,string,string,uint256,uint256))",
  
  // Cross-chain bridging function
  "function bridge(uint destChainId, address recipient, uint nftId) returns ()",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 tokenId)",
  "event NFTMinted(address indexed owner, uint256 tokenId)",
  "event NFTBridged(address indexed owner, uint256 tokenId, uint256 destChainId, address recipient)",
  "event NFTReceived(address indexed recipient, uint256 tokenId, uint256 sourceChainId)"
];

/**
 * Connect to wallet using ethers
 * This function:
 * 1. Checks if a wallet is available
 * 2. Requests account access
 * 3. Creates a provider and signer
 * 4. Gets the user's address and current chain ID
 * 
 * @returns {Promise<Object>} Provider, signer, address, and chain ID
 * @throws {Error} If no wallet is found or connection fails
 */
export async function connectWallet() {
  // Check if MetaMask or another web3 wallet is installed
  if (!window.ethereum) {
    throw new Error("No Ethereum wallet found. Please install MetaMask or another Web3 wallet.");
  }

  try {
    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Create provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const chainId = await getChainId();

    console.log(`Connected to wallet: ${address} on chain ID: ${chainId}`);
    return { provider, signer, address, chainId };
  } catch (error) {
    console.error('Error connecting to wallet:', error);
    throw new Error(`Failed to connect wallet: ${error.message || 'User rejected the connection'}`);
  }
}

/**
 * Get current chain ID from the connected wallet
 * 
 * @returns {Promise<number>} Chain ID as a number
 * @returns {null} If no wallet is connected
 */
export async function getChainId() {
  if (!window.ethereum) return null;
  try {
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  } catch (error) {
    console.error('Error getting chain ID:', error);
    return null;
  }
}

/**
 * Switch to a different network in the wallet
 * If the network doesn't exist in the wallet, it will be added automatically
 * 
 * @param {string} networkName - Network name (e.g., 'avalanche-testnet', 'base-testnet')
 * @throws {Error} If the network is not found or switching fails
 */
export async function switchNetwork(networkName) {
  if (!window.ethereum) {
    throw new Error("No Ethereum wallet found. Please install MetaMask or another Web3 wallet.");
  }

  // Get network configuration
  const network = networks[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not found in deployments`);
  }

  // Convert chain ID to hex format (required by MetaMask)
  const chainIdHex = `0x${network.chainId.toString(16)}`;
  
  try {
    console.log(`Switching to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    
    console.log(`Successfully switched to ${network.name}`);
  } catch (error) {
    // If the network is not added to the wallet, add it
    if (error.code === 4902) {
      console.log(`Network ${network.name} not found in wallet, adding it...`);
      
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: network.name,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: network.blockExplorer ? [network.blockExplorer] : [],
            },
          ],
        });
        
        console.log(`Successfully added and switched to ${network.name}`);
      } catch (addError) {
        console.error('Error adding network:', addError);
        throw new Error(`Failed to add network: ${addError.message || 'User rejected the request'}`);
      }
    } else {
      console.error('Error switching network:', error);
      throw new Error(`Failed to switch network: ${error.message || 'User rejected the request'}`);
    }
  }
}

/**
 * Create an NFT contract instance
 * 
 * @param {string} contractAddress - Contract address
 * @param {Object} signer - Ethers signer
 * @returns {Object} Contract instance with connected signer
 */
export function getTokenContract(contractAddress, signer) {
  try {
    return new ethers.Contract(contractAddress, nftABI, signer);
  } catch (error) {
    console.error('Error creating contract instance:', error);
    throw new Error(`Failed to create contract instance: ${error.message}`);
  }
}

/**
 * Get NFT count for an address
 * This is a simple wrapper around the contract's balanceOf function
 * 
 * @param {Object} contract - NFT contract instance
 * @param {string} address - Wallet address
 * @returns {Promise<number>} Number of NFTs owned by the address
 */
export async function getNFTCount(contract, address) {
  try {
    const balance = await contract.balanceOf(address);
    return Number(balance);
  } catch (error) {
    console.error('Error getting NFT count:', error);
    throw new Error(`Failed to get NFT count: ${error.message}`);
  }
}

/**
 * Mint a new NFT
 * 
 * @param {Object} contract - NFT contract instance
 * @returns {Promise<Object>} Transaction receipt and NFT ID
 */
export async function mintNFT(contract) {
  try {
    console.log('Minting new NFT...');
    
    // Send the transaction
    const tx = await contract.mint();
    console.log(`Mint transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Get the NFT ID from the event
    let nftId = null;
    try {
      // Find the NFTMinted event
      const event = receipt.logs
        .map(log => {
          try {
            return contract.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean)
        .find(event => event.name === 'NFTMinted');
      
      if (event) {
        nftId = event.args.tokenId.toString();
      }
    } catch (error) {
      console.warn('Could not parse NFT ID from event:', error);
    }
    
    return { receipt, nftId };
  } catch (error) {
    console.error('Error minting NFT:', error);
    
    // Provide more specific error messages but don't show alerts
    if (error.code === 'ACTION_REJECTED') {
      console.error('Transaction was rejected by the user');
      throw error;
    } else {
      console.error(`Failed to mint NFT: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }
}

/**
 * Bridge an NFT from the current chain to another chain
 * This function:
 * 1. Calls the bridge function on the contract with the NFT ID
 * 2. Waits for the transaction to be confirmed
 * 
 * @param {Object} contract - NFT contract instance
 * @param {number} destChainId - Destination chain ID
 * @param {string} recipient - Recipient address
 * @param {string} nftId - NFT ID to bridge
 * @returns {Promise<Object>} Transaction receipt
 */
export async function bridgeNFT(contract, destChainId, recipient, nftId) {
  try {
    console.log(`Bridging NFT #${nftId} to chain ID ${destChainId}, recipient: ${recipient || 'self'}`);
    
    // Send the transaction
    const tx = await contract.bridge(destChainId, recipient, nftId);
    console.log(`Bridge transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    return receipt;
  } catch (error) {
    console.error('Error bridging NFT:', error);
    
    // Provide more specific error messages but don't show alerts
    if (error.code === 'ACTION_REJECTED') {
      console.error('Transaction was rejected by the user');
      throw error;
    } else if (error.message && error.message.includes('caller is not the owner')) {
      console.error('You do not own this NFT');
      throw error;
    } else {
      console.error(`Failed to bridge NFT: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }
}

// Create a lookup map for faster network retrieval by chainId
const networksByChainId = {};

// Populate the lookup map
Object.entries(networks).forEach(([key, network]) => {
  networksByChainId[network.chainId] = { ...network, key };
});

/**
 * Find a network configuration by chain ID
 * 
 * @param {number} chainId - Chain ID to look up
 * @returns {Object|null} Network configuration or null if not found
 */
export function getNetworkByChainId(chainId) {
  if (!chainId) return null;
  const chainIdNum = Number(chainId);
  return networksByChainId[chainIdNum] || null;
}

/**
 * Get all available networks from deployments
 * 
 * @returns {Object} All networks
 */
export function getAllNetworks() {
  return { ...networks }; // Return a copy to prevent modification
}

/**
 * Set up listeners for wallet events
 * This function sets up handlers for:
 * - accountsChanged: When the user switches accounts or disconnects
 * - chainChanged: When the user switches networks
 * 
 * @param {Function} callback - Callback function to handle events
 */
export function listenForWalletEvents(callback) {
  if (!window.ethereum) {
    console.warn('No Ethereum wallet found, cannot listen for events');
    return;
  }

  // Remove any existing listeners to prevent duplicates
  window.ethereum.removeAllListeners('accountsChanged');
  window.ethereum.removeAllListeners('chainChanged');

  // Set up account change listener
  window.ethereum.on('accountsChanged', (accounts) => {
    console.log('Wallet accounts changed:', accounts);
    callback({ type: 'accountsChanged', accounts });
  });

  // Set up network change listener
  window.ethereum.on('chainChanged', (chainId) => {
    const chainIdNum = parseInt(chainId, 16);
    console.log('Wallet network changed to chain ID:', chainIdNum);
    callback({ type: 'chainChanged', chainId: chainIdNum });
  });
  
  console.log('Wallet event listeners set up successfully');
}
