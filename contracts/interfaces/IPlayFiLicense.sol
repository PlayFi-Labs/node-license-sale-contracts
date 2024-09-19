// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC721EnumerableUpgradeable.sol";


interface IPlayFiLicense is IERC721EnumerableUpgradeable
{
    event LicenseMinted(address indexed receiver,uint256 indexed tokenId);

    error AccessDenied();
    error UnexistingToken(uint256 tokenId);
    error InvalidAddress(address account);
    error TransferNotAllowed(address from, address to, uint256 firstTokenId);

    function mint(address receiver, uint256 amount) external;
    function currentLicenseId() external view returns (uint256);
}
