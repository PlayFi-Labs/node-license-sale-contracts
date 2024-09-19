// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IPlayFiLicenseMint.sol";
import "./interfaces/IPlayFiLicense.sol";


/// @title PlayFi node license mint contract
/// @author Archethect
/// @notice Contract used to mint PlayFi node licenses.
contract PlayFiLicenseMint is
Initializable,
EIP712Upgradeable,
AccessControlUpgradeable,
IPlayFiLicenseMint
{
    using Strings for string;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN");
    bytes32 public constant MERKLE_MANAGER_ROLE = keccak256("MERKLE_MANAGER");
    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(string message,address minter)");
    string public constant MINT_MESSAGE = "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!";

    bytes32 public override mintMerkleRoot;
    bool public override paused;
    IPlayFiLicense public override playFiLicense;

    mapping(address => uint256) public licensesMintedPerAddress;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address guardian,
        address merkleManager,
        address _playFiLicense
    ) public initializer {
        __EIP712_init("PlayFiLicenseMint", "1.0.0");
        __AccessControl_init();

        if (admin == address(0)) revert InvalidAddress(admin);
        if (guardian == address(0)) revert InvalidAddress(guardian);
        if (merkleManager == address(0)) revert InvalidAddress(merkleManager);
        if (_playFiLicense == address(0)) revert InvalidAddress(_playFiLicense);

        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(GUARDIAN_ROLE, admin);
        _setRoleAdmin(GUARDIAN_ROLE, ADMIN_ROLE);
        _grantRole(MERKLE_MANAGER_ROLE, merkleManager);
        _setRoleAdmin(MERKLE_MANAGER_ROLE, ADMIN_ROLE);

        paused = true;
        playFiLicense = IPlayFiLicense(_playFiLicense);

        emit ContractInitialized();
    }

    /// @notice Mints licenses after checking the minter address provides a valid signature and the proof is valid for the configured merkle root.
    /// @param claimAddress The address used on Arbitrum to but/claim the licenses.
    /// @param claimData Index and claimCap of eligible licenses in encoded format
    /// @param amount The amount of licenses to mint
    /// @param merkleProof The proof used to verify whether original claimer is allowed to claim licenses
    /// @param signature The signature proving the current address has ownership over the address usd to buy the licenses on Arbitrum
    function mintLicenses(address claimAddress, bytes calldata claimData, uint256 amount, bytes32[] calldata merkleProof, bytes calldata signature) public whenNotPaused {
        (uint256 index, uint256 claimCap) = abi.decode(claimData,(uint256,uint256));
        uint256 mintedLicenses = licensesMintedPerAddress[claimAddress];
        if(mintedLicenses + amount > claimCap) revert MintCapExceeded();
        bytes32 node = keccak256(abi.encodePacked(index, claimAddress, claimCap));
        if (!MerkleProof.verify(merkleProof, mintMerkleRoot, node)) revert InvalidProof();
        bytes32 messageHash = _hash();
        if(!SignatureChecker.isValidSignatureNow(claimAddress,messageHash,signature)) revert InvalidSignature();
        licensesMintedPerAddress[claimAddress] = mintedLicenses + amount;
        playFiLicense.mint(msg.sender,amount);
        emit LicensesMinted(claimAddress,msg.sender,amount);
    }

    /// @notice Sets the license mint merkle root
    /// @param _mintMerkleRoot The root of the license mint merkle tree
    function setMintMerkleRoot(bytes32 _mintMerkleRoot) public onlyMerkleManager {
        mintMerkleRoot = _mintMerkleRoot;
        emit MintMerkleRootSet(_mintMerkleRoot);
    }

    /// @notice Pauses/unpauses the contract
    /// @param status Boolean to enable or disable the contract
    function setPaused(bool status) public onlyGuardian {
        paused = status;
        emit Paused(status);
    }

    function _hash(
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("Mint(string message,address minter)"),
                    keccak256(bytes(MINT_MESSAGE)),
                    msg.sender
                )
            )
        );
    }

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyMerkleManager() {
        if (!hasRole(MERKLE_MANAGER_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyGuardian() {
        if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
}
