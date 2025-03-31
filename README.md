# Cross-Chain NFT Example

This project demonstrates how to create and deploy a cross-chain NFT using VIA's messaging protocol. The NFT can be bridged between different blockchain networks, allowing for seamless NFT transfers across chains.

## Prerequisites

Before you begin, make sure you have:

- Node.js (v16+) and npm
- Git
- A private key with testnet funds for deployment
- Testnet tokens for:
  - Avalanche Testnet
  - Base Testnet

## Project Structure

```
quickstart-nft/
├── contracts/
│   └── MyNFT.sol           # The NFT contract with cross-chain functionality
├── scripts/
│   ├── deploy.js           # Deploy script using ethers v6 (also mints an initial NFT)
│   └── bridge.js           # Bridge NFTs between chains
├── frontend/               # React frontend for interacting with the NFTs
├── network.config.js       # Network configuration
├── package.json            # Project dependencies
├── .env.example            # Example environment variables
└── README.md               # Project documentation
```

## Setup

1. Clone the repository:
```bash
git clone https://github.com/VIALabs-io/quickstart-nft.git
cd quickstart-nft
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your private key:
```bash
cp .env.example .env
```

Edit the `.env` file and add your private key. Make sure your private key has testnet tokens for both networks.

## Deployment and Configuration

This project includes a single script that handles compilation, deployment, and cross-chain configuration:

```bash
node scripts/deploy.js
```

This script will:
1. Compile the MyNFT.sol contract
2. Deploy the contract to all configured networks (Avalanche Testnet and Base Testnet)
3. Configure cross-chain messaging between all deployed contracts
4. Save deployment information for the frontend

## Deployment and Minting

The deployment script handles compilation, deployment, and cross-chain configuration. It also automatically mints an initial NFT on each chain:

```bash
node scripts/deploy.js
```

This script will:
1. Compile the MyNFT.sol contract
2. Deploy the contract to all configured networks (Avalanche Testnet and Base Testnet)
3. Mint an initial NFT on each network
4. Configure cross-chain messaging between all deployed contracts
5. Save deployment information for the frontend

## Bridging NFTs

You can bridge NFTs between networks using the provided script:

```bash
node scripts/bridge.js avalanche-testnet
```

This command lists all NFTs you own on Avalanche Testnet.

```bash
node scripts/bridge.js avalanche-testnet base-testnet
```

This command lists all NFTs you own on Avalanche Testnet and provides instructions for bridging.

```bash
node scripts/bridge.js avalanche-testnet base-testnet 100001
```

This command bridges NFT #100001 from Avalanche Testnet to Base Testnet.

You can also specify a recipient address:

```bash
node scripts/bridge.js avalanche-testnet base-testnet 100001 0x1234...
```

## Frontend

The project includes a React-based frontend for interacting with the NFT contracts. The frontend provides a user-friendly interface for:
- Connecting your wallet
- Viewing your NFTs on different networks
- Minting new NFTs
- Bridging NFTs between networks
- Monitoring cross-chain events in real-time

### Running the Frontend

To start the frontend development server with hot reloading:

```bash
cd frontend
npm install
npm run dev
```

This will start the development server on http://localhost:5173. The page will automatically reload if you make changes to the code.

### Building for Production

To create a production build:

```bash
cd frontend
npm install
npm run build
```

This will create an optimized build in the `frontend/dist` folder that you can deploy to any static hosting service.

**Important**: You must run the deployment script first before using the frontend. If the contracts haven't been deployed, the frontend will display an error message with instructions.

## How It Works

### Contract

The `MyNFT` contract is an ERC721 token with added cross-chain functionality:

- It inherits from OpenZeppelin's `ERC721Enumerable`
- It implements VIA's `MessageClient` for cross-chain messaging
- When NFTs are bridged, they are burned on the source chain and minted on the destination chain
- The contract includes helper functions to list NFTs owned by a user and get NFT metadata

### Cross-Chain Messaging

The cross-chain functionality works as follows:

1. When a user bridges an NFT, the NFT is burned on the source chain
2. A cross-chain message is sent to the destination chain with the NFT's metadata
3. The message is processed on the destination chain, and the NFT is minted to the recipient with the same ID and metadata

### Deployment Process

The deployment script:
1. Compiles the contract using solc 0.8.17
2. Deploys the contract to all configured networks
3. Configures cross-chain messaging between all deployed contracts
4. Saves deployment information for both the backend scripts and the frontend

## Customizing the NFT

You can customize the NFT by modifying the `MyNFT.sol` contract:

- Change the NFT name and symbol in the constructor
- Modify the metadata structure
- Add additional functionality as needed

## Adding More Networks

To add more networks, edit the `network.config.js` file and add new network configurations:

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
  // 'polygon-testnet': {
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
```

After adding a new network, run the deployment script again:

```bash
node scripts/deploy.js
```

The script is designed to:
1. Skip deployment for networks that already have deployments (preserving existing NFT contracts)
2. Deploy only to new networks that don't have existing deployments
3. Reconfigure all contracts to work with each other, including the new ones
