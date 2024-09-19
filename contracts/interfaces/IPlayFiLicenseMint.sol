// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPlayFiLicense} from "./IPlayFiLicense.sol";


interface IPlayFiLicenseMint
{
    event Paused(bool status);
    event MintMerkleRootSet(bytes32 merkleRoot);
    event LicensesMinted(address indexed originalBuyer, address indexed minter, uint256 amount);
    event ContractInitialized();

    error MintCapExceeded();
    error ContractPaused();
    error InvalidProof();
    error InvalidSignature();
    error AccessDenied();
    error InvalidAddress(address account);

    function mintLicenses(address claimAddress, bytes calldata claimData, uint256 amount, bytes32[] calldata merkleProof, bytes calldata signature) external;
    function setMintMerkleRoot(bytes32 _mintMerkleRoot) external;
    function setPaused(bool status) external;
    function mintMerkleRoot() external view returns (bytes32);
    function paused() external view returns (bool);
    function playFiLicense() external view returns (IPlayFiLicense playFiLicense);

}
