# Native Cross-Chain NFT

## Prerequisites

Before you begin, make sure you have:

- Node.js (v20+) and npm
- Git
- A private key with testnet funds for deployment
- Testnet tokens for:
  - Avalanche Testnet
  - Base Testnet

## Step 1: Clone & Setup

```bash
# Clone the repository
git clone https://github.com/VIALabs-io/quickstart-nft.git && cd quickstart-nft

# Install dependencies
npm install

# Create a .env file with your private key
cp .env.example .env
```

## Step 2: Deploy Your NFT

```bash
node scripts/deploy.js
```

## Step 3: Bridge NFTs Between Networks

```bash
# List NFTs on Avalanche Testnet
node scripts/bridge.js avalanche-testnet

# Bridge NFT #431130000 from Avalanche Testnet to Base Testnet
node scripts/bridge.js avalanche-testnet base-testnet 431130000
```

## Step 4: Use the Frontend

```bash
# Start the frontend
cd frontend
npm install
npm run dev
```

🎉 Congratulations! You've successfully created and used a cross-chain NFT.

# Adding More Networks

## Step 1: Edit Network Configuration

Edit the network.config.js file and add new network configurations:

```javascript
// Add a new network
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
    blockExplorer: 'https://sepolia-explorer.base.org',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },
  // Add your new network here
  // Example for adding Polygon Mumbai:
  'polygon-testnet': {
    name: 'polygon-testnet',
    chainId: 80001,
    rpcUrl: process.env.POLYGON_TESTNET_RPC || 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  }
};
```

## Step 2: Deploy

```bash
node scripts/deploy.js
```