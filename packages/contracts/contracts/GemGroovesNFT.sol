// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TrackSplitter.sol";

/**
 * @title GemGroovesNFT
 * @notice ERC-721 music NFT. Each token is a unique track.
 *         Metadata stored on IPFS. Deploys a TrackSplitter per token.
 *         Implements EIP-2981 royalty standard.
 */
contract GemGroovesNFT is ERC721URIStorage, IERC2981, Ownable {

    struct TrackInfo {
        address artist;
        uint96  royaltyBPS;
        address splitter;
    }

    uint256 private _nextTokenId;
    address public marketplace;

    mapping(uint256 => TrackInfo) private _tracks;

    event TrackMinted(
        uint256 indexed tokenId,
        address indexed artist,
        address splitter,
        string  tokenURI,
        uint96  royaltyBPS
    );
    event MarketplaceUpdated(address indexed newMarketplace);

    error Unauthorized();
    error RoyaltyTooHigh();

    constructor() ERC721("GemGrooves", "GEMG") Ownable(msg.sender) {}

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
        emit MarketplaceUpdated(_marketplace);
    }

    function mint(
        address   artist,
        string    calldata tokenURI_,
        uint96    royaltyBPS,
        address[] calldata wallets,
        uint256[] calldata sharesBPS
    ) external returns (uint256 tokenId, address splitter) {
        if (msg.sender != marketplace && msg.sender != owner()) revert Unauthorized();
        if (royaltyBPS > 5_000) revert RoyaltyTooHigh();

        uint256 id = _nextTokenId++;
        TrackSplitter ts = new TrackSplitter(address(this), id, wallets, sharesBPS);

        _safeMint(artist, id);
        _setTokenURI(id, tokenURI_);

        _tracks[id] = TrackInfo({
            artist:     artist,
            royaltyBPS: royaltyBPS,
            splitter:   address(ts)
        });

        emit TrackMinted(id, artist, address(ts), tokenURI_, royaltyBPS);
        return (id, address(ts));
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external view override
        returns (address receiver, uint256 royaltyAmount)
    {
        TrackInfo storage t = _tracks[tokenId];
        receiver      = t.splitter;
        royaltyAmount = (salePrice * t.royaltyBPS) / 10_000;
    }

    function getTrackInfo(uint256 tokenId)
        external view
        returns (address artist, uint96 royaltyBPS, address splitter)
    {
        TrackInfo storage t = _tracks[tokenId];
        return (t.artist, t.royaltyBPS, t.splitter);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
