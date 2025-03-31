require('dotenv').config();

// Network configurations - can be extended with more networks as needed
const networks = {
  'avalanche-testnet': {
    name: 'avalanche-testnet',
    chainId: 43113,
    rpcUrl: process.env.AVALANCHE_TESTNET_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
    blockExplorer: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  'base-testnet': {
    name: 'base-testnet',
    chainId: 84532,
    rpcUrl: process.env.BASE_TESTNET_RPC || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org/',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  }
  // Add more networks here as needed
  // Example for adding Polygon Mumbai Testnet:
  // mumbai: {
  //   name: 'polygon-testnet',
  //   chainId: 80001,
  //   rpcUrl: process.env.POLYGON_TESTNET_RPC || 'https://rpc-mumbai.maticvigil.com',
  //   blockExplorer: 'https://mumbai.polygonscan.com',
  //   nativeCurrency: {
  //     name: 'MATIC',
  //     symbol: 'MATIC',
  //     decimals: 18
  //   }
  // }
};

/**
 * Get network configuration by name
 * @param {string} networkName - Network name (e.g., 'avalanche-testnet', 'base-testnet')
 * @returns {Object|null} Network configuration or null if not found
 */
function getNetworkConfig(networkName) {
  return networks[networkName] || null;
}

/**
 * Get all available network names
 * @returns {string[]} Array of network names
 */
function getNetworkNames() {
  return Object.keys(networks);
}

/**
 * Get all network configurations
 * @returns {Object} All network configurations
 */
function getAllNetworks() {
  return networks;
}

module.exports = {
  networks,
  getNetworkConfig,
  getNetworkNames,
  getAllNetworks
};
