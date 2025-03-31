/**
 * NetworkSelector Component
 * =========================
 * 
 * This component allows users to select different blockchain networks.
 * It displays all available networks from the deployments and highlights the current network.
 * When a user selects a network, it updates the UI but doesn't switch networks immediately.
 * 
 * Features:
 * - Custom dropdown with network logos
 * - Balance display in dropdown options
 * - Mobile-friendly design
 * - Keyboard accessibility
 */

import React, { useState, useRef, useEffect } from 'react';

function NetworkSelector({ 
  networks, 
  currentChainId,
  selectedNetwork,
  onNetworkChange, 
  label,
  placeholder = "Select network",
  balances = {}
}) {
  // State for dropdown open/close
  const [isOpen, setIsOpen] = useState(false);
  
  // Refs for click outside detection
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  
  // Get all networks as an array of [key, network] pairs
  const networkOptions = Object.entries(networks);
  
  // If no networks are available, show a message
  if (!networks || networkOptions.length === 0) {
    return (
      <div className="network-selector-container">
        <p>No networks available</p>
      </div>
    );
  }
  
  // Find the selected network object
  const selectedNetworkObj = selectedNetwork ? networks[selectedNetwork] : null;
  
  // Get chain logo URL or first letter for placeholder
  const getNetworkLogo = (network) => {
    const chainId = network.chainId;
    const logoUrl = chainId ? `https://scan.vialabs.io/images/logos/chains/${chainId}.png` : null;
    return logoUrl;
  };
  
  // Handle network selection
  const handleNetworkSelect = (networkKey) => {
    if (networkKey) {
      onNetworkChange(networkKey);
      setIsOpen(false);
    }
  };
  
  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      toggleDropdown();
    } else if (e.key === 'Tab' && isOpen) {
      setIsOpen(false);
    }
  };
  
  // Format balance display
  const formatBalance = (balance, symbol = 'MYERC20') => {
    if (!balance) return '0';
    
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) return '0';
    
    if (balanceNum === 0) return `0 ${symbol}`;
    
    if (balanceNum < 0.001) return `<0.001 ${symbol}`;
    
    return `${balanceNum.toLocaleString(undefined, {
      maximumFractionDigits: 3
    })} ${symbol}`;
  };
  
  return (
    <div className="network-selector-container">
      {label && <label className="network-label" id={`${label.replace(/\s+/g, '-').toLowerCase()}-label`}>{label}</label>}
      
      {/* Hidden native select for accessibility */}
      <select 
        className="network-select-native"
        value={selectedNetwork || ""}
        onChange={(e) => handleNetworkSelect(e.target.value)}
        aria-labelledby={label ? `${label.replace(/\s+/g, '-').toLowerCase()}-label` : undefined}
      >
        <option value="" disabled>{placeholder}</option>
        {networkOptions.map(([key, network]) => (
          <option key={key} value={key}>
            {network.name}
          </option>
        ))}
      </select>
      
      {/* Custom select trigger */}
      <div 
        className={`network-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        ref={triggerRef}
      >
        {selectedNetworkObj ? (
          <div className="selected-network-display">
            <div className="network-icon-small">
              {getNetworkLogo(selectedNetworkObj) ? (
                <img src={getNetworkLogo(selectedNetworkObj)} alt={selectedNetworkObj.name} />
              ) : (
                selectedNetworkObj.name.charAt(0)
              )}
            </div>
            <span>{selectedNetworkObj.name}</span>
          </div>
        ) : (
          <span className="network-select-placeholder">{placeholder}</span>
        )}
      </div>
      
      {/* Dropdown options */}
      <div 
        className={`network-select-dropdown ${isOpen ? 'open' : ''}`}
        ref={dropdownRef}
        role="listbox"
        aria-labelledby={label ? `${label.replace(/\s+/g, '-').toLowerCase()}-label` : undefined}
      >
        {networkOptions.map(([key, network]) => {
          const isSelected = key === selectedNetwork;
          const chainId = network.chainId;
          const balance = balances[chainId] || '0';
          
          return (
            <div 
              key={key}
              className={`network-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleNetworkSelect(key)}
              role="option"
              aria-selected={isSelected}
              tabIndex={isOpen ? 0 : -1}
            >
              <div className="network-icon-small">
                {getNetworkLogo(network) ? (
                  <img src={getNetworkLogo(network)} alt={network.name} />
                ) : (
                  network.name.charAt(0)
                )}
              </div>
              <div className="network-option-content">
                <div className="network-option-name">{network.name}</div>
                <div className="network-option-balance">
                  Balance: {formatBalance(balance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NetworkSelector;
