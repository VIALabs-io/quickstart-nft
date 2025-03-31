// SPDX-License-Identifier: MIT
// (c)2024 Atlas (atlas@vialabs.io)
pragma solidity =0.8.17;

import "@vialabs-io/npm-contracts/MessageClient.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MyNFT
 * @dev Cross-chain NFT implementation with bridging capabilities
 */
contract MyNFT is ERC721Enumerable, MessageClient {
    using Strings for uint256;
    
    uint public nextNftId;
    
    // Events
    event NFTMinted(address indexed owner, uint256 tokenId);
    event NFTBridged(address indexed owner, uint256 tokenId, uint256 destChainId, address recipient);
    event NFTReceived(address indexed recipient, uint256 tokenId, uint256 sourceChainId);
    
    // Struct to store NFT metadata
    struct NFTMetadata {
        string name;
        string description;
        string image;
        uint256 chainId;
        uint256 mintedAt;
    }
    
    // Mapping to store additional metadata for each token
    mapping(uint256 => NFTMetadata) private _tokenMetadata;

    constructor() ERC721("Cross Chain NFT", "CCNFT") {
        MESSAGE_OWNER = msg.sender;
        nextNftId = block.chainid * 10**4;
    }

    /**
     * @dev Mint a new NFT to the caller
     * @return tokenId The ID of the newly minted NFT
     */
    function mint() external returns (uint256) {
        uint256 tokenId = nextNftId;
        _mint(msg.sender, tokenId);
        
        // Store metadata
        _tokenMetadata[tokenId] = NFTMetadata({
            name: string(abi.encodePacked("Cross Chain NFT #", tokenId.toString())),
            description: "Cross-chain NFT that can be bridged between networks",
            image: "https://i.postimg.cc/FKkpPByb/cl-logo.png",
            chainId: block.chainid,
            mintedAt: block.timestamp
        });
        
        nextNftId++;
        
        emit NFTMinted(msg.sender, tokenId);
        return tokenId;
    }

    /**
     * @dev Bridge an NFT to another chain
     * @param _destChainId Destination chain ID
     * @param _recipient Recipient address on the destination chain
     * @param _nftId Token ID to bridge
     */
    function bridge(uint _destChainId, address _recipient, uint _nftId) external onlyActiveChain(_destChainId) {
        require(ownerOf(_nftId) == msg.sender, "MyNFT: caller is not the owner of the NFT");
        
        // Store the metadata before burning
        NFTMetadata memory metadata = _tokenMetadata[_nftId];
        
        // Burn the NFT on this chain
        _burn(_nftId);
        
        // Send the message to the destination chain
        _sendMessage(_destChainId, abi.encode(_recipient, _nftId, metadata));
        
        emit NFTBridged(msg.sender, _nftId, _destChainId, _recipient);
    }

    /**
     * @dev Process incoming message from another chain
     * @param _sourceChainId Source chain ID
     * @param _data Encoded message data
     */
    function _processMessage(uint _sourceChainId, uint /* _sourceMsgSender */, bytes calldata _data) internal virtual override {
        (address _recipient, uint _nftId, NFTMetadata memory metadata) = abi.decode(_data, (address, uint, NFTMetadata));
        
        // Mint the NFT on this chain
        _mint(_recipient, _nftId);
        
        // Store the metadata
        _tokenMetadata[_nftId] = metadata;
        
        emit NFTReceived(_recipient, _nftId, _sourceChainId);
    }

    /**
     * @dev Get the token URI for a given token ID
     * @param tokenId Token ID to query
     * @return Token URI as a string
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        
        NFTMetadata memory metadata = _tokenMetadata[tokenId];
        
        return string(abi.encodePacked('data:application/json;base64,', 
            Base64.encode(bytes(abi.encodePacked(
                '{"name":"', metadata.name, '",',
                '"description":"', metadata.description, '",',
                '"image":"', metadata.image, '",',
                '"attributes":[',
                    '{"trait_type":"Origin Chain","value":"', metadata.chainId.toString(), '"},',
                    '{"trait_type":"Minted At","value":"', metadata.mintedAt.toString(), '"}',
                ']}'
            ))))
        );
    }
    
    /**
     * @dev Get metadata for a specific token
     * @param _tokenId Token ID to query
     * @return Metadata struct containing token information
     */
    function getTokenMetadata(uint256 _tokenId) external view returns (NFTMetadata memory) {
        require(_exists(_tokenId), "MyNFT: token does not exist");
        return _tokenMetadata[_tokenId];
    }
    
    /**
     * @dev Get all tokens owned by a specific address
     * @param _owner Address to query
     * @return Array of token IDs owned by the address
     */
    function getTokensByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(_owner);
        
        if (tokenCount == 0) {
            return new uint256[](0);
        }
        
        uint256[] memory result = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(_owner, i);
        }
        
        return result;
    }
    
    /**
     * @dev Get detailed information for all tokens owned by an address
     * @param _owner Address to query
     * @return tokenIds Array of token IDs
     * @return metadataList Array of metadata structs
     */
    function getTokensWithMetadata(address _owner) external view returns (
        uint256[] memory tokenIds,
        NFTMetadata[] memory metadataList
    ) {
        uint256 tokenCount = balanceOf(_owner);
        
        tokenIds = new uint256[](tokenCount);
        metadataList = new NFTMetadata[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            tokenIds[i] = tokenId;
            metadataList[i] = _tokenMetadata[tokenId];
        }
        
        return (tokenIds, metadataList);
    }
}
