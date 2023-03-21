pragma solidity ^0.8.0;

import "https://github.com/lth-elm/ERC721-Buyable-Standard/blob/main/contracts/ERC721Buyable.sol";

contract GemGroove is ERC721Full {
    constructor() public ERC721Full("GemGroove", "GGC") { }

    function registerGemgroove(address owner, string memory tokenURI)
        public
        returns (uint256)
    {
        uint256 tokenId = totalSupply();
        _mint(owner, tokenId);
        _setTokenURI(tokenId, tokenURI);

        return tokenId;
    }
}