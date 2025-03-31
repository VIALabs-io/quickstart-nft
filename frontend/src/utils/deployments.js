/**
 * Deployments Utility Functions
 * =============================
 * 
 * This module provides utility functions for handling contract deployments.
 * It loads deployment information from the deployments.json file and provides
 * functions to access and validate this information.
 * 
 * The deployment information includes:
 * - Contract addresses for each network
 * - ABIs for interacting with the contracts
 * - Chain IDs and network information
 */

// Import deployments directly for Vite
import deploymentsJson from '../config/deployments.json';

// Initialize deployments
let deployments = deploymentsJson || {};
let loadError = null;

// Validate the loaded deployments
if (Object.keys(deployments).length === 0) {
  loadError = "Deployments file exists but contains no deployments";
  console.warn('Deployments file exists but contains no deployments');
} else {
  console.log(`Loaded deployments for ${Object.keys(deployments).length} chains`);
}

/**
 * Check if deployments exist and are valid
 * 
 * @returns {boolean} True if deployments exist, false otherwise
 */
export function deploymentsExist() {
  return Object.keys(deployments).length > 0;
}

/**
 * Get deployment information for a specific chain ID
 * 
 * @param {number} chainId - Chain ID to look up
 * @returns {Object|null} Deployment information or null if not found
 */
export function getDeploymentByChainId(chainId) {
  // Convert chainId to string if it's a number
  const chainIdKey = chainId.toString();
  
  if (deployments[chainIdKey]) {
    return deployments[chainIdKey];
  }
  
  // Also try with the number format
  if (deployments[chainId]) {
    return deployments[chainId];
  }
  
  console.warn(`No deployment found for chain ID ${chainId}`);
  return null;
}

/**
 * Get all available deployments
 * 
 * @returns {Object} All deployments
 */
export function getAllDeployments() {
  return { ...deployments }; // Return a copy to prevent modification
}

/**
 * Get deployment error message if deployments don't exist
 * 
 * @returns {string|null} Error message or null if deployments exist
 */
export function getDeploymentErrorMessage() {
  if (!deploymentsExist()) {
    return loadError || "No contract deployments found. Please run the deploy.js script first.";
  }
  return null;
}

/**
 * Get the number of available networks in the deployments
 * 
 * @returns {number} Number of networks
 */
export function getNetworkCount() {
  return Object.keys(deployments).length;
}

/**
 * Check if a specific chain ID is supported
 * 
 * @param {number} chainId - Chain ID to check
 * @returns {boolean} True if the chain ID is supported, false otherwise
 */
export function isChainSupported(chainId) {
  return !!getDeploymentByChainId(chainId);
}

// Create a deployments object with all utility functions
const deploymentsUtils = {
  deploymentsExist,
  getDeploymentByChainId,
  getAllDeployments,
  getDeploymentErrorMessage,
  getNetworkCount,
  isChainSupported
};

// Export as named exports and default export
export default deploymentsUtils;
