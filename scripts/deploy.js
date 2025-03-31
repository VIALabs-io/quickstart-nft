/**
 * Cross-Chain NFT Deployment Script
 * ================================
 * 
 * This script handles the deployment and configuration of the MyNFT contract
 * across multiple blockchain networks. It's designed to:
 * 
 * 1. Compile the Solidity contract
 * 2. Deploy to multiple networks (only if not already deployed)
 * 3. Configure cross-chain messaging between all deployments
 * 4. Save deployment information for both backend scripts and frontend
 * 
 * The script is safe to run multiple times - it will preserve existing deployments
 * and only deploy to new networks that have been added to the configuration.
 * 
 * INTEGRATION NOTES:
 * - This script uses ethers.js v6 for blockchain interactions
 * - The core logic can be adapted to work with any deployment framework
 * - Key components to preserve when integrating:
 *   - Checking for existing deployments
 *   - Configuring cross-chain messaging
 *   - Saving deployment information for the frontend
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { getChainConfig } = require('@vialabs-io/npm-registry');
const { execSync } = require('child_process');
const { networks, getNetworkNames } = require('../network.config');
require('dotenv').config();

// ======================================================================
// SECTION 1: CONTRACT COMPILATION
// ======================================================================

/**
 * Compiles the MyNFT.sol contract using solcjs
 * @returns {Promise<boolean>} True if compilation was successful, false otherwise
 */
async function compileContract() {
  console.log('=== Compiling Contract ===');
  try {
    // Create build directory if it doesn't exist
    const buildDir = path.join(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    
    // Compile the contract with optimizer enabled
    console.log('Running solcjs compiler with optimizer...');
    execSync('npx solcjs --bin --abi --include-path node_modules/ --base-path . -o ./build --optimize --optimize-runs 200 contracts/MyNFT.sol', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    console.log('Compilation successful!');
    return true;
  } catch (error) {
    console.error('Compilation failed:', error.message);
    return false;
  }
}

// ======================================================================
// SECTION 2: DEPLOYMENT MANAGEMENT
// ======================================================================

/**
 * Check if a deployment already exists for a network
 * This prevents redeploying to networks that already have contracts.
 * 
 * @param {string} networkName - Network name
 * @returns {Promise<Object|null>} Existing deployment or null if not found
 */
async function checkExistingDeployment(networkName) {
  const network = networks[networkName];
  const deploymentDir = path.join(__dirname, '../deployments', network.name);
  const deploymentFile = path.join(deploymentDir, 'MyNFT.json');
  
  if (fs.existsSync(deploymentFile)) {
    try {
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      console.log(`Existing deployment found for ${network.name}`);
      
      // Setup provider to get contract instance
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
      
      // Create contract instance
      const contract = new ethers.Contract(
        deploymentInfo.address,
        deploymentInfo.abi,
        wallet
      );
      
      return {
        address: deploymentInfo.address,
        chainId: deploymentInfo.chainId,
        contract: contract,
        isExisting: true
      };
    } catch (error) {
      console.warn(`Error reading existing deployment for ${network.name}:`, error.message);
      return null;
    }
  }
  
  return null;
}

/**
 * Deploy the contract to a specific network if it doesn't already exist
 * This function handles:
 * 1. Checking for existing deployments
 * 2. Deploying the contract if needed
 * 3. Saving deployment information for both backend and frontend
 * 
 * @param {string} networkName - Network name from network.config.js
 * @returns {Promise<Object|null>} Deployment information or null if failed
 */
async function deployToNetwork(networkName) {
  const network = networks[networkName];
  console.log(`\n=== Processing ${network.name} ===`);

  // Check if deployment already exists
  const existingDeployment = await checkExistingDeployment(networkName);
  if (existingDeployment) {
    console.log(`Using existing deployment at ${existingDeployment.address}`);
    return existingDeployment;
  }
  
  console.log(`No existing deployment found. Deploying to ${network.name}...`);

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  
  console.log(`Using wallet address: ${wallet.address}`);

  // Get chain ID
  const providerNetwork = await provider.getNetwork();
  const chainId = providerNetwork.chainId;
  console.log(`Chain ID: ${chainId}`);

  // Get chain config
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    console.error(`Chain configuration not found for chainId: ${chainId}`);
    return null;
  }
  
  console.log(`Deploying to ${chainConfig.name} (${chainConfig.network})...`);

  // Read contract files
  const contractPath = path.join(__dirname, '../build');
  
  // Find ABI and bytecode files
  const files = fs.readdirSync(contractPath);
  const abiFile = files.find(file => file.includes('MyNFT.abi'));
  const binFile = files.find(file => file.includes('MyNFT.bin'));
  
  if (!abiFile || !binFile) {
    console.error('ABI or bytecode files not found after compilation.');
    return null;
  }
  
  const abi = JSON.parse(fs.readFileSync(path.join(contractPath, abiFile), 'utf8'));
  const bytecode = '0x' + fs.readFileSync(path.join(contractPath, binFile), 'utf8');

  // Deploy contract
  console.log('Deploying MyNFT contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  
  console.log(`Transaction hash: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for deployment...');
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log(`Contract deployed to: ${contractAddress}`);

  // Save deployment info
  const deploymentDir = path.join(__dirname, '../deployments', network.name);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  const deploymentInfo = {
    address: contractAddress,
    abi: abi,
    network: network.name,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentDir, 'MyNFT.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  fs.writeFileSync(
    path.join(deploymentDir, '.chainId'),
    chainId.toString()
  );
  
  // Also save to a frontend-accessible location
  const frontendConfigDir = path.join(__dirname, '../frontend/src/config');
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }
  
  // Update or create the deployments.json file
  const frontendConfigPath = path.join(frontendConfigDir, 'deployments.json');
  let frontendDeployments = {};
  
  // Read existing deployments if file exists
  if (fs.existsSync(frontendConfigPath)) {
    try {
      const existingConfig = fs.readFileSync(frontendConfigPath, 'utf8');
      frontendDeployments = JSON.parse(existingConfig);
    } catch (error) {
      console.warn('Error reading existing frontend deployments:', error.message);
    }
  }
  
  // Update with new deployment
  // Use the existing chainConfig for additional information
  const chainIdKey = Number(chainId);
  frontendDeployments[chainIdKey] = {
    address: contractAddress,
    network: network.name,
    chainId: chainIdKey,
    deployedAt: new Date().toISOString(),
    abi: abi, // Include ABI for the frontend and scripts
    rpcUrl: network.rpcUrl, // Include RPC URL for the frontend
    blockExplorer: chainConfig?.explorer || '' // Get block explorer from chain config
  };
  
  // Write updated deployments
  fs.writeFileSync(
    frontendConfigPath,
    JSON.stringify(frontendDeployments, null, 2)
  );
  
  console.log(`Deployment information saved to ${deploymentDir}/MyNFT.json`);
  console.log(`Frontend deployment config updated at ${frontendConfigPath}`);
  
  // Mint an initial NFT
  console.log('\nMinting an initial NFT...');
  try {
    const mintTx = await contract.mint();
    console.log(`Mint transaction hash: ${mintTx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await mintTx.wait();
    
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
        console.log(`Successfully minted NFT #${nftId}`);
      } else {
        console.log('NFT minted successfully, but could not determine the NFT ID');
      }
    } catch (error) {
      console.warn('Could not parse NFT ID from event:', error.message);
      console.log('NFT minted successfully, but could not determine the NFT ID');
    }
  } catch (error) {
    console.error('Error minting initial NFT:', error.message);
    console.log('Continuing with deployment process...');
  }
  
  return {
    address: contractAddress,
    chainId: Number(chainId),
    contract: contract,
    isExisting: false
  };
}

// ======================================================================
// SECTION 3: CROSS-CHAIN CONFIGURATION
// ======================================================================

/**
 * Configure cross-chain messaging between all deployed contracts
 * This is a critical step that enables tokens to be bridged between networks
 * 
 * @param {Array<Object>} deployments - Array of deployment objects
 * @returns {Promise<void>}
 */
async function configureContracts(deployments) {
  console.log('\n=== Configuring Cross-Chain Messaging ===');
  
  if (deployments.length < 2) {
    console.error('Need at least 2 deployments to configure cross-chain messaging');
    return;
  }
  
  // For each deployment, configure it to work with all other deployments
  for (let i = 0; i < deployments.length; i++) {
    const currentDeployment = deployments[i];
    
    console.log(`\nConfiguring contract on chain ${currentDeployment.chainId}...`);
    
    // Get chain config
    const chainConfig = getChainConfig(currentDeployment.chainId);
    if (!chainConfig || !chainConfig.message) {
      console.error(`Message contract address not found for chainId: ${currentDeployment.chainId}`);
      continue;
    }
    
    console.log(`Using message contract: ${chainConfig.message}`);
    
    // Prepare arrays for all other chains
    const otherChainIds = [];
    const otherAddresses = [];
    const confirmations = [];
    
    // Collect information about all other deployments
    for (let j = 0; j < deployments.length; j++) {
      if (i !== j) {
        otherChainIds.push(deployments[j].chainId);
        otherAddresses.push(deployments[j].address);
        confirmations.push(1); // Default confirmation blocks
      }
    }
    
    try {
      // Configure client with all other chains
      console.log(`Configuring with ${otherChainIds.length} other chains: ${otherChainIds.join(', ')}`);
      
      const tx = await currentDeployment.contract.configureClient(
        chainConfig.message,
        otherChainIds,
        otherAddresses,
        confirmations
      );
      
      console.log(`Configuration transaction hash: ${tx.hash}`);
      console.log('Waiting for confirmation...');
      
      await tx.wait();
      console.log('Configuration completed successfully!');
    } catch (error) {
      console.error(`Error configuring contract on chain ${currentDeployment.chainId}:`, error.message);
    }
  }
}

// ======================================================================
// SECTION 4: MAIN EXECUTION
// ======================================================================

/**
 * Main execution function that orchestrates the entire deployment process
 * 1. Compiles the contract
 * 2. Deploys to all networks (preserving existing deployments)
 * 3. Configures cross-chain messaging between all deployments
 */
async function main() {
  console.log('=== MyNFT Deployment and Configuration ===');
  
  // Compile the contract first
  const compilationSuccess = await compileContract();
  if (!compilationSuccess) {
    console.error('Compilation failed. Aborting deployment.');
    process.exit(1);
  }
  
  // Deploy to all networks
  const deployments = [];
  
  for (const networkName of Object.keys(networks)) {
    const deployment = await deployToNetwork(networkName);
    if (deployment) {
      deployments.push(deployment);
    }
  }
  
  if (deployments.length >= 2) {
    // Configure cross-chain messaging
    await configureContracts(deployments);
    console.log('\n=== Deployment and Configuration Completed Successfully! ===');
  } else {
    console.error('\nFailed to deploy to at least two networks. Configuration skipped.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
