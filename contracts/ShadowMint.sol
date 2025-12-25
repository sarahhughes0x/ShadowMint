// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @title ShadowMint - Encrypted owner-aware NFT
/// @notice Stores a secret real owner address per token using Zama FHE. Only addresses granted ACL can decrypt it.
contract ShadowMint is ZamaEthereumConfig {
    struct TokenData {
        address owner;
        eaddress realOwner;
        string metadataURI;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => TokenData) private _tokens;
    mapping(address owner => uint256) private _balances;
    mapping(address owner => uint256[]) private _ownedTokens;
    mapping(uint256 tokenId => uint256) private _ownedTokenIndex;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed minter, uint256 indexed tokenId, string metadataURI);
    event DecryptPermissionGranted(uint256 indexed tokenId, address indexed account);

    string public constant NAME = "ShadowMint";
    string public constant SYMBOL = "SHDW";

    /// @notice Returns the token collection name.
    function name() external pure returns (string memory) {
        return NAME;
    }

    /// @notice Returns the token collection symbol.
    function symbol() external pure returns (string memory) {
        return SYMBOL;
    }

    /// @notice Returns total minted supply.
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /// @notice Returns the balance for the given owner.
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Invalid owner");
        return _balances[owner];
    }

    /// @notice Returns the owner for the given tokenId.
    function ownerOf(uint256 tokenId) public view returns (address) {
        TokenData storage token = _tokens[tokenId];
        require(token.owner != address(0), "Token does not exist");
        return token.owner;
    }

    /// @notice Returns the tokenURI for the given tokenId.
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _getToken(tokenId).metadataURI;
    }

    /// @notice Returns the encrypted real owner handle stored for the tokenId.
    function getEncryptedRealOwner(uint256 tokenId) external view returns (eaddress) {
        return _getToken(tokenId).realOwner;
    }

    /// @notice Returns all token ids owned by the given address.
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }

    /// @notice Mints a new NFT with an encrypted real owner address.
    /// @param metadataURI Optional metadata URI for the token.
    /// @param encryptedRealOwner Real owner address encrypted client-side through the Zama gateway.
    /// @param inputProof Proof produced by the gateway for the encrypted input.
    /// @return tokenId The id of the minted token.
    function mint(string calldata metadataURI, externalEaddress encryptedRealOwner, bytes calldata inputProof)
        external
        returns (uint256 tokenId)
    {
        eaddress validatedRealOwner = FHE.fromExternal(encryptedRealOwner, inputProof);

        tokenId = _nextTokenId++;
        _tokens[tokenId] = TokenData({owner: msg.sender, realOwner: validatedRealOwner, metadataURI: metadataURI});
        _balances[msg.sender] += 1;

        _ownedTokenIndex[tokenId] = _ownedTokens[msg.sender].length;
        _ownedTokens[msg.sender].push(tokenId);

        FHE.allowThis(validatedRealOwner);
        FHE.allow(validatedRealOwner, msg.sender);

        emit Transfer(address(0), msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, metadataURI);
        emit DecryptPermissionGranted(tokenId, msg.sender);
    }

    /// @notice Grants decryption rights for the stored real owner address to another account.
    /// @dev Only the current token owner can call this.
    function grantDecryptPermission(uint256 tokenId, address account) external {
        TokenData storage token = _getToken(tokenId);
        require(msg.sender == token.owner, "Caller is not token owner");
        require(account != address(0), "Invalid account");

        FHE.allow(token.realOwner, account);
        emit DecryptPermissionGranted(tokenId, account);
    }

    /// @notice Transfers a token to another address and shares decrypt permission with the receiver.
    /// @dev Approvals are intentionally omitted; only the token owner can initiate the transfer.
    function transferFrom(address from, address to, uint256 tokenId) public {
        TokenData storage token = _getToken(tokenId);
        require(token.owner == from, "Transfer from incorrect owner");
        require(msg.sender == from, "Caller is not owner");
        require(to != address(0), "Invalid receiver");

        _balances[from] -= 1;
        _balances[to] += 1;

        _removeOwnedToken(from, tokenId);
        _addOwnedToken(to, tokenId);

        token.owner = to;

        FHE.allow(token.realOwner, to);

        emit Transfer(from, to, tokenId);
        emit DecryptPermissionGranted(tokenId, to);
    }

    /// @notice Safe transfer overload without data.
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
        require(_checkOnERC721Received(msg.sender, from, to, tokenId, ""), "Invalid receiver");
    }

    /// @notice Safe transfer overload with data.
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external {
        transferFrom(from, to, tokenId);
        require(_checkOnERC721Received(msg.sender, from, to, tokenId, data), "Invalid receiver");
    }

    /// @notice Minimal ERC165 support.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd // ERC721
            || interfaceId == 0x5b5e139f // ERC721 Metadata
            || interfaceId == 0x01ffc9a7; // ERC165
    }

    function _getToken(uint256 tokenId) private view returns (TokenData storage token) {
        token = _tokens[tokenId];
        require(token.owner != address(0), "Token does not exist");
    }

    function _addOwnedToken(address owner, uint256 tokenId) private {
        _ownedTokenIndex[tokenId] = _ownedTokens[owner].length;
        _ownedTokens[owner].push(tokenId);
    }

    function _removeOwnedToken(address owner, uint256 tokenId) private {
        uint256 lastIndex = _ownedTokens[owner].length - 1;
        uint256 index = _ownedTokenIndex[tokenId];

        if (index != lastIndex) {
            uint256 lastTokenId = _ownedTokens[owner][lastIndex];
            _ownedTokens[owner][index] = lastTokenId;
            _ownedTokenIndex[lastTokenId] = index;
        }

        _ownedTokens[owner].pop();
        delete _ownedTokenIndex[tokenId];
    }

    function _checkOnERC721Received(address operator, address from, address to, uint256 tokenId, bytes memory data)
        private
        returns (bool)
    {
        if (to.code.length == 0) {
            return true;
        }

        try IERC721Receiver(to).onERC721Received(operator, from, tokenId, data) returns (bytes4 retval) {
            return retval == IERC721Receiver.onERC721Received.selector;
        } catch {
            return false;
        }
    }
}
