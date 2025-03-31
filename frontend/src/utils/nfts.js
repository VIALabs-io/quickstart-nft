/**
 * NFT Utility Functions
 * ====================
 * 
 * This module provides utility functions for managing NFTs across different chains.
 * It includes functions for:
 * - Fetching NFTs from different chains
 * - Caching NFT data to reduce RPC calls
 * - Retrieving NFT metadata
 * - Managing NFT collections
 * - Refreshing NFT data
 */

import { ethers } from 'ethers';
import { deploymentsExist, getDeploymentByChainId } from './deployments';

// Forward declarations to avoid circular dependencies
let getTokenContract;
let getNetworkByChainId;

// Set up the imported functions
export function setupDependencies(tokenContractFn, networkByChainIdFn) {
  getTokenContract = tokenContractFn;
  getNetworkByChainId = networkByChainIdFn;
}

// Cache for providers to avoid creating new ones for each NFT check
let providerCache = {};

/**
 * Fetch NFTs for the current chain
 * 
 * @param {Object} contract - NFT contract instance
 * @param {string} address - Wallet address
 * @param {number} chainId - Current chain ID
 * @param {Function} setNFTs - State setter for NFTs
 * @param {Function} setIsLoadingNFTs - State setter for loading state
 */
export async function fetchNFTsForCurrentChain(contract, address, chainId, setNFTs, setIsLoadingNFTs) {
  if (!contract || !address || !chainId) return;
  
  setIsLoadingNFTs(prev => ({ ...prev, [chainId]: true }));
  
  try {
    // Get NFTs with metadata
    const nftsWithMetadata = await contract.getTokensWithMetadata(address);
    
    // Format the NFTs
    const tokenIds = nftsWithMetadata[0];
    const metadataList = nftsWithMetadata[1];
    
    const formattedNFTs = tokenIds.map((id, index) => {
      const metadata = metadataList[index];
      return {
        id: id.toString(),
        name: metadata[0],
        description: metadata[1],
        image: metadata[2],
        chainId: Number(metadata[3]),
        mintedAt: Number(metadata[4]),
        originChain: Number(metadata[3])
      };
    });
    
    // Update state
    setNFTs(prev => ({ ...prev, [chainId]: formattedNFTs }));
  } catch (error) {
    console.error(`Error fetching NFTs for chain ${chainId}:`, error);
    setNFTs(prev => ({ ...prev, [chainId]: [] }));
  } finally {
    setIsLoadingNFTs(prev => ({ ...prev, [chainId]: false }));
  }
}

/**
 * Fetch NFTs for a specific chain
 * 
 * @param {string} address - Wallet address
 * @param {number} targetChainId - Target chain ID
 * @param {number} currentChainId - Current chain ID
 * @param {Object} lastFetchTime - Last fetch time for each chain
 * @param {Function} setLastFetchTime - State setter for last fetch time
 * @param {Function} setNFTs - State setter for NFTs
 * @param {Function} setIsLoadingNFTs - State setter for loading state
 * @param {Function} setProviderCache - State setter for provider cache
 * @returns {Promise<void>}
 */
export async function fetchNFTsForChain(
  address,
  targetChainId,
  currentChainId,
  lastFetchTime,
  setLastFetchTime,
  setNFTs,
  setIsLoadingNFTs,
  setProviderCache
) {
  if (!address || !targetChainId || !deploymentsExist()) return;
  
  // Don't fetch if it's the current chain
  if (Number(targetChainId) === Number(currentChainId)) {
    return;
  }
  
  // Check if we've fetched these NFTs recently (within the last 10 seconds)
  const now = Date.now();
  const lastFetch = lastFetchTime[targetChainId] || 0;
  if (now - lastFetch < 10000) {
    console.log(`Skipping NFT fetch for chain ${targetChainId} - fetched recently`);
    return;
  }
  
  const deployment = getDeploymentByChainId(targetChainId);
  if (!deployment) {
    console.error(`No deployment found for chain ID ${targetChainId}`);
    return;
  }
  
  setIsLoadingNFTs(prev => ({ ...prev, [targetChainId]: true }));
  
  try {
    // Create or reuse provider for target chain
    let provider;
    if (providerCache[targetChainId]) {
      provider = providerCache[targetChainId];
    } else {
      const network = getNetworkByChainId(targetChainId);
      if (!network || !network.rpcUrl) {
        throw new Error(`No RPC URL found for chain ID ${targetChainId}`);
      }
      
      provider = new ethers.JsonRpcProvider(network.rpcUrl);
      
      // Cache the provider
      if (setProviderCache) {
        setProviderCache(prev => ({ ...prev, [targetChainId]: provider }));
        providerCache[targetChainId] = provider;
      }
    }
    
    const contract = getTokenContract(deployment.address, provider);
    
    // Get NFT IDs
    const tokenIds = await contract.getTokensByOwner(address);
    
    // If there are no NFTs, set an empty array
    if (tokenIds.length === 0) {
      setNFTs(prev => ({ ...prev, [targetChainId]: [] }));
      setLastFetchTime(prev => ({ ...prev, [targetChainId]: now }));
      return;
    }
    
    // Get metadata for each NFT
    const nfts = [];
    for (let i = 0; i < tokenIds.length; i++) {
      try {
        const tokenId = tokenIds[i];
        const metadata = await contract.getTokenMetadata(tokenId);
        
        nfts.push({
          id: tokenId.toString(),
          name: metadata[0],
          description: metadata[1],
          image: metadata[2],
          chainId: Number(metadata[3]),
          mintedAt: Number(metadata[4]),
          originChain: Number(metadata[3])
        });
      } catch (error) {
        console.error(`Error fetching metadata for NFT ${tokenIds[i]}:`, error);
      }
    }
    
    // Update state
    setNFTs(prev => ({ ...prev, [targetChainId]: nfts }));
    
    // Update last fetch time
    setLastFetchTime(prev => ({ ...prev, [targetChainId]: now }));
  } catch (error) {
    console.error(`Error fetching NFTs for chain ${targetChainId}:`, error);
    setNFTs(prev => ({ ...prev, [targetChainId]: [] }));
  } finally {
    setIsLoadingNFTs(prev => ({ ...prev, [targetChainId]: false }));
  }
}

/**
 * Refresh NFTs for source and destination chains
 * 
 * @param {Function} fetchNFTsForCurrentChainFn - Function to fetch NFTs for current chain
 * @param {Function} fetchNFTsForChainFn - Function to fetch NFTs for a specific chain
 * @param {string} destNetwork - Destination network key
 * @param {Object} networks - All available networks
 */
export function refreshNFTs(
  fetchNFTsForCurrentChainFn,
  fetchNFTsForChainFn,
  destNetwork,
  networks
) {
  // Fetch source NFTs
  fetchNFTsForCurrentChainFn();
  
  // Fetch destination NFTs if needed
  if (destNetwork) {
    const destChainId = networks[destNetwork]?.chainId;
    if (destChainId) {
      fetchNFTsForChainFn(destChainId);
    }
  }
}

/**
 * Get NFT count for a specific chain
 * 
 * @param {Object} nfts - NFTs object with chain IDs as keys
 * @param {number} chainId - Chain ID
 * @returns {number} Number of NFTs on the chain
 */
export function getNFTCountForChain(nfts, chainId) {
  if (!nfts || !chainId) return 0;
  return (nfts[chainId] || []).length;
}

/**
 * Get NFT by ID for a specific chain
 * 
 * @param {Object} nfts - NFTs object with chain IDs as keys
 * @param {number} chainId - Chain ID
 * @param {string} nftId - NFT ID
 * @returns {Object|null} NFT object or null if not found
 */
export function getNFTById(nfts, chainId, nftId) {
  if (!nfts || !chainId || !nftId) return null;
  const chainNFTs = nfts[chainId] || [];
  return chainNFTs.find(nft => nft.id === nftId) || null;
}

/**
 * Get metadata for a specific NFT
 * 
 * @param {Object} contract - NFT contract instance
 * @param {string} tokenId - NFT ID
 * @returns {Promise<Object>} NFT metadata
 */
export async function getNFTMetadata(contract, tokenId) {
  try {
    const metadata = await contract.getTokenMetadata(tokenId);
    return {
      name: metadata[0],
      description: metadata[1],
      image: metadata[2],
      chainId: Number(metadata[3]),
      mintedAt: Number(metadata[4])
    };
  } catch (error) {
    console.error('Error getting NFT metadata:', error);
    throw new Error(`Failed to get NFT metadata: ${error.message}`);
  }
}

/**
 * Get all NFTs with metadata owned by an address
 * 
 * @param {Object} contract - NFT contract instance
 * @param {string} address - Wallet address
 * @returns {Promise<Array>} Array of NFTs with metadata
 */
export async function getNFTsWithMetadata(contract, address) {
  try {
    const [tokenIds, metadataList] = await contract.getTokensWithMetadata(address);
    
    return tokenIds.map((id, index) => {
      const metadata = metadataList[index];
      return {
        id: id.toString(),
        name: metadata[0],
        description: metadata[1],
        image: metadata[2],
        chainId: Number(metadata[3]),
        mintedAt: Number(metadata[4])
      };
    });
  } catch (error) {
    console.error('Error getting NFTs with metadata:', error);
    throw new Error(`Failed to get NFTs with metadata: ${error.message}`);
  }
}

/**
 * Get all NFTs owned by an address
 * 
 * @param {Object} contract - NFT contract instance
 * @param {string} address - Wallet address
 * @returns {Promise<Array>} Array of NFT IDs owned by the address
 */
export async function getNFTsByOwner(contract, address) {
  try {
    const tokenIds = await contract.getTokensByOwner(address);
    return tokenIds.map(id => id.toString());
  } catch (error) {
    console.error('Error getting NFTs by owner:', error);
    throw new Error(`Failed to get NFTs: ${error.message}`);
  }
}
