// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./GemGroovesNFT.sol";
import "./TrackSplitter.sol";

/**
 * @title GemGroovesMarketplace
 * @notice Primary sales marketplace for GemGrooves music NFTs.
 *         Accepts ETH, USDC, and DAI. Takes a platform fee on each sale.
 *         Routes proceeds through TrackSplitter to co-creators.
 */
contract GemGroovesMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 priceWei;
        address payToken;
        address splitter;
        bool    active;
    }

    GemGroovesNFT public immutable nft;
    uint256 public platformFeeBPS;
    address public feeRecipient;

    mapping(address => bool)    public allowedTokens;
    mapping(uint256 => Listing) public listings;

    event TrackListed(uint256 indexed tokenId, address indexed seller, uint256 price, address payToken, address splitter);
    event TrackSold(uint256 indexed tokenId, address indexed buyer, uint256 price, address payToken, uint256 platformFee);
    event ListingCancelled(uint256 indexed tokenId);
    event PlatformFeeUpdated(uint256 newFeeBPS);
    event TokenAllowanceUpdated(address token, bool allowed);

    error NotListed();
    error ListingInactive();
    error TokenNotAllowed();
    error IncorrectETHAmount();
    error NotSeller();
    error FeeTooHigh();

    constructor(
        address _nft,
        uint256 _platformFeeBPS,
        address _feeRecipient,
        address _usdc,
        address _dai
    ) Ownable(msg.sender) {
        if (_platformFeeBPS > 2_000) revert FeeTooHigh();
        nft            = GemGroovesNFT(_nft);
        platformFeeBPS = _platformFeeBPS;
        feeRecipient   = _feeRecipient;
        allowedTokens[_usdc] = true;
        allowedTokens[_dai]  = true;
    }

    function listTrack(
        string    calldata tokenURI_,
        uint96    royaltyBPS,
        address[] calldata wallets,
        uint256[] calldata sharesBPS,
        uint256   priceWei,
        address   payToken
    ) external {
        if (payToken != address(0) && !allowedTokens[payToken]) revert TokenNotAllowed();

        (uint256 tokenId, address splitter) = nft.mint(
            msg.sender, tokenURI_, royaltyBPS, wallets, sharesBPS
        );

        listings[tokenId] = Listing({
            seller:   msg.sender,
            priceWei: priceWei,
            payToken: payToken,
            splitter: splitter,
            active:   true
        });

        emit TrackListed(tokenId, msg.sender, priceWei, payToken, splitter);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        if (!l.active) revert ListingInactive();
        if (l.seller != msg.sender) revert NotSeller();
        l.active = false;
        emit ListingCancelled(tokenId);
    }

    function buyWithETH(uint256 tokenId) external payable nonReentrant {
        Listing storage l = _getActiveListing(tokenId);
        if (l.payToken != address(0)) revert TokenNotAllowed();
        if (msg.value != l.priceWei) revert IncorrectETHAmount();

        l.active = false;

        uint256 fee      = (msg.value * platformFeeBPS) / 10_000;
        uint256 proceeds = msg.value - fee;

        _sendETH(feeRecipient, fee);
        _sendETH(l.splitter, proceeds);
        TrackSplitter(payable(l.splitter)).releaseETH();

        nft.safeTransferFrom(l.seller, msg.sender, tokenId);
        emit TrackSold(tokenId, msg.sender, msg.value, address(0), fee);
    }

    function buyWithToken(uint256 tokenId, address token) external nonReentrant {
        Listing storage l = _getActiveListing(tokenId);
        if (l.payToken != token) revert TokenNotAllowed();
        if (!allowedTokens[token]) revert TokenNotAllowed();

        l.active = false;

        IERC20 erc20     = IERC20(token);
        uint256 price    = l.priceWei;
        uint256 fee      = (price * platformFeeBPS) / 10_000;
        uint256 proceeds = price - fee;

        erc20.safeTransferFrom(msg.sender, address(this), price);
        erc20.safeTransfer(feeRecipient, fee);
        erc20.safeTransfer(l.splitter, proceeds);
        TrackSplitter(payable(l.splitter)).releaseERC20(token);

        nft.safeTransferFrom(l.seller, msg.sender, tokenId);
        emit TrackSold(tokenId, msg.sender, price, token, fee);
    }

    function setPlatformFee(uint256 newFeeBPS) external onlyOwner {
        if (newFeeBPS > 2_000) revert FeeTooHigh();
        platformFeeBPS = newFeeBPS;
        emit PlatformFeeUpdated(newFeeBPS);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    function setTokenAllowance(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowanceUpdated(token, allowed);
    }

    function _getActiveListing(uint256 tokenId) internal view returns (Listing storage l) {
        l = listings[tokenId];
        if (l.seller == address(0)) revert NotListed();
        if (!l.active) revert ListingInactive();
    }

    function _sendETH(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{ value: amount }("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {}
}
