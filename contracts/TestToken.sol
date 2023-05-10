// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.5.0) (token/ERC20/presets/ERC20PresetFixedSupply.sol)
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

contract TestToken is ERC20PresetFixedSupply {
    mapping(address => bool) public forbidden;

    constructor()
        ERC20PresetFixedSupply("TestToken", "TT", 100000000 ether, msg.sender)
    {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint amount
    ) internal override {
        require(!forbidden[to], "Forbidden");
    }

    function setForbidden(address user) external {
        forbidden[user] = true;
    }
}
