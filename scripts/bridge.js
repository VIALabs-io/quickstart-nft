/**
 * Cross-Chain NFT Bridge Script
 * ============================
 * 
 * This script allows bridging NFTs between different blockchain networks.
 * It reads deployment information from the frontend config and uses it to:
 * 
 * 1. Connect to the source network
 * 2. Bridge an NFT to the destination network
 * 3. Provide feedback on the bridging process
 * 
 * The script is designed to work with the MyNFT contract deployed
 * by the deploy.js script.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { networks } = require('../network.config');
require('dotenv').config();

/**
 * Get contract instance for a specific network
 * This function reads deployment information from the frontend config
 * 
 * @param {string} networkName - Network name from network.config.js
 * @returns {Promise<Object>} Contract instance and related information
 */
async function getContract(networkName) {
  const network = networks[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not found`);
  }
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  
  // Get deployment info from the frontend config
  const frontendConfigPath = path.join(__dirname, '../frontend/src/config/deployments.json');
  
  if (!fs.existsSync(frontendConfigPath)) {
    throw new Error(`Deployment configuration not found. Please deploy the contract first.`);
  }
  
  const deployments = JSON.parse(fs.readFileSync(frontendConfigPath, 'utf8'));
  const providerNetwork = await provider.getNetwork();
  const chainId = providerNetwork.chainId;
  
  const chainIdKey = Number(chainId);
  if (!deployments[chainIdKey]) {
    throw new Error(`No deployment found for chain ID ${chainIdKey}. Please deploy the contract first.`);
  }
  
  const deploymentInfo = deployments[chainIdKey];
  
  // Create contract instance
  return {
    contract: new ethers.Contract(deploymentInfo.address, deploymentInfo.abi, wallet),
    chainId: deploymentInfo.chainId,
    network: network
  };
}

/**
 * Wait for the NFT to be received on the destination chain using polling
 * 
 * @param {Object} destContract - Destination contract instance
 * @param {string} sourceChainId - Source chain ID
 * @param {string} recipientAddress - Recipient address
 * @param {string} nftId - NFT ID being bridged
 * @param {Object} destNetwork - Destination network information
 * @param {string} txHash - Source transaction hash
 * @param {number} timeout - Timeout in milliseconds (default: 5 minutes)
 * @returns {Promise<Object|null>} Event object or null if timeout
 */
async function waitForNFTReceived(destContract, sourceChainId, recipientAddress, nftId, destNetwork, txHash, timeout = 5 * 60 * 1000) {
  console.log(`\nWaiting for NFT to be received on the destination chain...`);
  console.log(`This may take a few minutes. Timeout set to ${timeout/1000} seconds.`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    
    // Polling function to check for NFT ownership
    const checkOwnership = async () => {
      try {
        // Try to get the owner of the NFT
        try {
          const currentOwner = await destContract.ownerOf(nftId);
          
          // If the NFT exists and is owned by the recipient
          if (currentOwner.toLowerCase() === recipientAddress.toLowerCase()) {
            console.log(`\n✅ NFT received on destination chain!`);
            console.log(`   NFT ID: ${nftId}`);
            console.log(`   Recipient: ${recipientAddress}`);
            
            // Get NFT metadata if available
            try {
              const metadata = await destContract.getTokenMetadata(nftId);
              console.log(`   NFT Name: ${metadata.name}`);
              console.log(`   Origin Chain: ${metadata.chainId}`);
            } catch (metadataError) {
              console.log(`   (Metadata not available)`);
            }
            
            // Provide links to explorers
            if (destNetwork.blockExplorer) {
              const recipientExplorerUrl = `${destNetwork.blockExplorer}/address/${recipientAddress}`;
              console.log(`\nView recipient's wallet on destination chain explorer:`);
              console.log(recipientExplorerUrl);
            }
            
            // Show VIA Labs scanner links
            console.log(`\nView on VIA Labs scanner:`);
            console.log(`Transaction: https://scan.vialabs.io/transaction/${txHash}`);
            
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            resolve({ recipient: recipientAddress, nftId: nftId });
            return;
          }
        } catch (ownerError) {
          // NFT doesn't exist yet on the destination chain
          // This is expected until the bridging completes
        }
        
        // Check if we've reached the timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(intervalId);
          console.log(`\n⚠️ Timeout reached. NFT may still be received later.`);
          console.log(`   You can check your NFTs on the destination chain manually.`);
          resolve(null);
        }
      } catch (error) {
        console.log(`Error checking NFT ownership: ${error.message}`);
      }
    };
    
    // Start polling
    const intervalId = setInterval(checkOwnership, pollInterval);
    
    // Initial check
    checkOwnership();
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      console.log(`\n⚠️ Timeout reached. NFT may still be received later.`);
      console.log(`   You can check your NFTs on the destination chain manually.`);
      resolve(null);
    }, timeout);
    
    // Allow early cancellation
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      console.log(`\n⚠️ Monitoring cancelled. NFT may still be received later.`);
      console.log(`   You can check your NFTs on the destination chain manually.`);
      resolve(null);
      process.exit(0);
    });
  });
}

/**
 * List NFTs owned by the current wallet on a specific network
 * 
 * @param {Object} contract - Contract instance
 * @param {string} address - Wallet address
 * @param {string} networkName - Network name
 * @returns {Promise<void>}
 */
async function listNFTs(contract, address, networkName) {
  console.log(`\n=== NFTs owned on ${networkName} ===`);
  
  try {
    // Get token IDs owned by the address
    const tokenIds = await contract.getTokensByOwner(address);
    
    if (tokenIds.length === 0) {
      console.log(`No NFTs found on ${networkName}.`);
      console.log(`You can mint a new NFT with: node scripts/mint.js ${networkName}`);
      return [];
    }
    
    console.log(`Found ${tokenIds.length} NFT(s):`);
    
    // Get metadata for each token
    const nfts = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      console.log(`\nNFT #${i+1}:`);
      console.log(`  ID: ${tokenId}`);
      
      try {
        // Try to get metadata
        const metadata = await contract.getTokenMetadata(tokenId);
        console.log(`  Name: ${metadata.name}`);
        console.log(`  Origin Chain: ${metadata.chainId}`);
        console.log(`  Minted At: ${new Date(Number(metadata.mintedAt) * 1000).toISOString()}`);
        
        nfts.push({
          id: tokenId.toString(),
          name: metadata.name,
          originChain: metadata.chainId.toString(),
          mintedAt: metadata.mintedAt.toString()
        });
      } catch (error) {
        console.log(`  Metadata: Not available`);
        nfts.push({
          id: tokenId.toString(),
          name: `NFT #${tokenId}`,
          originChain: 'Unknown',
          mintedAt: 'Unknown'
        });
      }
    }
    
    return nfts;
  } catch (error) {
    console.error(`Error listing NFTs: ${error.message}`);
    return [];
  }
}

/**
 * Bridge an NFT from source network to destination network
 * 
 * @param {string} sourceNetwork - Source network name
 * @param {string} destNetwork - Destination network name
 * @param {string} nftId - NFT ID to bridge
 * @param {string} recipient - Optional recipient address (defaults to sender)
 * @param {boolean} waitForCompletion - Whether to wait for the NFT to be received on the destination chain
 * @returns {Promise<void>}
 */
async function bridge(sourceNetwork, destNetwork, nftId, recipient, waitForCompletion = true) {
  console.log(`=== Bridging NFT #${nftId} from ${sourceNetwork} to ${destNetwork} ===`);
  
  // Get source contract
  const source = await getContract(sourceNetwork);
  console.log(`Source contract address: ${await source.contract.getAddress()}`);
  
  // Get destination contract
  const dest = await getContract(destNetwork);
  console.log(`Destination contract address: ${await dest.contract.getAddress()}`);
  
  // Check NFT ownership
  try {
    const owner = await source.contract.ownerOf(nftId);
    const walletAddress = source.contract.runner.address;
    
    if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error(`You don't own NFT #${nftId}. It is owned by ${owner}.`);
    }
    
    console.log(`Confirmed ownership of NFT #${nftId}`);
    
    // Get NFT metadata if available
    try {
      const metadata = await source.contract.getTokenMetadata(nftId);
      console.log(`NFT Name: ${metadata.name}`);
      console.log(`Origin Chain: ${metadata.chainId}`);
    } catch (metadataError) {
      console.log(`(Metadata not available)`);
    }
  } catch (error) {
    throw new Error(`Error checking NFT ownership: ${error.message}`);
  }
  
  // Use the recipient address or default to the sender's address
  const recipientAddress = recipient || source.contract.runner.address;
  console.log(`Recipient address: ${recipientAddress}`);
  
  // Bridge NFT
  console.log(`Bridging NFT #${nftId} to chain ID ${dest.chainId}...`);
  const tx = await source.contract.bridge(dest.chainId, recipientAddress, nftId);
  
  console.log(`Transaction hash: ${tx.hash}`);
  
  // Generate source chain explorer link
  if (source.network.blockExplorer) {
    const sourceExplorerUrl = `${source.network.blockExplorer}/tx/${tx.hash}`;
    console.log(`Source chain explorer: ${sourceExplorerUrl}`);
  }
  
  console.log('Waiting for confirmation...');
  
  await tx.wait();
  console.log('Bridge transaction confirmed!');
  
  console.log(`\nNFT is being bridged from ${sourceNetwork} to ${destNetwork}.`);
  console.log('The cross-chain message will take a few minutes to be processed.');
  
  // Wait for NFT to be received on the destination chain if requested
  if (waitForCompletion) {
    await waitForNFTReceived(
      dest.contract,
      source.chainId,
      recipientAddress,
      nftId,
      dest.network,
      tx.hash
    );
  } else {
    console.log(`Check your NFTs on ${destNetwork} after a few minutes.`);
  }
}

/**
 * Main execution function
 * Parses command line arguments and initiates the bridge process
 */
async function main() {
  // Get command line arguments
  const sourceNetwork = process.argv[2];
  const destNetwork = process.argv[3];
  const nftId = process.argv[4];
  const recipient = process.argv[5]; // Optional recipient address
  
  // If no source network is provided, show help
  if (!sourceNetwork) {
    console.log('NFT Bridge CLI');
    console.log('=============');
    console.log('\nUsage:');
    console.log('  node bridge.js <source-network> [dest-network] [nft-id] [recipient]');
    console.log('\nExamples:');
    console.log('  node bridge.js avalanche-testnet                     List NFTs on Avalanche testnet');
    console.log('  node bridge.js avalanche-testnet base-testnet 100001 Bridge NFT #100001 to Base testnet');
    console.log('\nAvailable networks:');
    
    for (const [key, network] of Object.entries(networks)) {
      console.log(`  ${key.padEnd(20)} ${network.name}`);
    }
    
    process.exit(0);
  }
  
  // Check if source network exists
  if (!networks[sourceNetwork]) {
    console.error(`Source network ${sourceNetwork} not found`);
    process.exit(1);
  }
  
  // If only source network is provided, list NFTs
  if (!destNetwork) {
    try {
      // Get contract
      const contract = await getContract(sourceNetwork);
      
      // List NFTs
      await listNFTs(contract.contract, contract.contract.runner.address, sourceNetwork);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    return;
  }
  
  // Check if destination network exists
  if (!networks[destNetwork]) {
    console.error(`Destination network ${destNetwork} not found`);
    process.exit(1);
  }
  
  // If no NFT ID is provided, list NFTs on source network
  if (!nftId) {
    try {
      // Get contract
      const contract = await getContract(sourceNetwork);
      
      // List NFTs
      const nfts = await listNFTs(contract.contract, contract.contract.runner.address, sourceNetwork);
      
      if (nfts.length === 0) {
        console.log(`\nNo NFTs found to bridge. Mint an NFT first by running the deploy script.`);
      } else {
        console.log(`\nTo bridge an NFT, run:`);
        console.log(`node bridge.js ${sourceNetwork} ${destNetwork} <nft-id>`);
        console.log(`Example: node bridge.js ${sourceNetwork} ${destNetwork} ${nfts[0]?.id || '100001'}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    return;
  }
  
  // Bridge the NFT
  try {
    await bridge(sourceNetwork, destNetwork, nftId, recipient, true);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
