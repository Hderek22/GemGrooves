// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrackSplitter
 * @notice Deployed once per track. Receives ETH or ERC-20 stablecoins
 *         and splits them proportionally among co-creators.
 */
contract TrackSplitter is ReentrancyGuard {

    struct Creator {
        address wallet;
        uint256 shareBPS;
    }

    Creator[] public creators;
    address public immutable nftContract;
    uint256 public immutable tokenId;

    event PaymentSplit(address indexed token, uint256 totalAmount);

    error InvalidSplits();
    error TransferFailed();
    error ZeroBalance();

    constructor(
        address _nftContract,
        uint256 _tokenId,
        address[] memory _wallets,
        uint256[] memory _sharesBPS
    ) {
        require(_wallets.length == _sharesBPS.length && _wallets.length > 0, "Invalid input");

        uint256 total;
        for (uint256 i = 0; i < _wallets.length; i++) {
            require(_wallets[i] != address(0), "Zero address");
            total += _sharesBPS[i];
            creators.push(Creator({ wallet: _wallets[i], shareBPS: _sharesBPS[i] }));
        }
        if (total != 10_000) revert InvalidSplits();

        nftContract = _nftContract;
        tokenId = _tokenId;
    }

    receive() external payable {}

    function releaseETH() external nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroBalance();

        for (uint256 i = 0; i < creators.length; i++) {
            uint256 share = (balance * creators[i].shareBPS) / 10_000;
            if (share > 0) {
                (bool ok, ) = creators[i].wallet.call{ value: share }("");
                if (!ok) revert TransferFailed();
            }
        }
        emit PaymentSplit(address(0), balance);
    }

    function releaseERC20(address token) external nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroBalance();

        for (uint256 i = 0; i < creators.length; i++) {
            uint256 share = (balance * creators[i].shareBPS) / 10_000;
            if (share > 0) {
                bool ok = IERC20(token).transfer(creators[i].wallet, share);
                if (!ok) revert TransferFailed();
            }
        }
        emit PaymentSplit(token, balance);
    }

    function getCreators() external view returns (Creator[] memory) {
        return creators;
    }

    function creatorCount() external view returns (uint256) {
        return creators.length;
    }
}
