// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "./interfaces/IPlayFiLicense.sol";

contract PlayFiLicense is
Initializable,
ERC721EnumerableUpgradeable,
AccessControlUpgradeable,
ReentrancyGuardUpgradeable,
IPlayFiLicense
{
    using StringsUpgradeable for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant LICENSE_MANAGER_ROLE = keccak256("LICENSE_MANAGER");

    uint256 public override currentLicenseId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address licenseManager) public initializer {
        __ERC721_init("LIFT Node License", "LIFT_NODE_LICENSE");
        __ERC721Enumerable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        if (admin == address(0)) revert InvalidAddress(admin);
        if (licenseManager == address(0)) revert InvalidAddress(licenseManager);

        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(LICENSE_MANAGER_ROLE, licenseManager);
        _setRoleAdmin(LICENSE_MANAGER_ROLE, ADMIN_ROLE);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert UnexistingToken(tokenId);
        address ownerAddress = ownerOf(tokenId);
        string memory svg = string(
            abi.encodePacked(
            "<svg width='500' height='500' viewBox='-250 -30 1000 1000' fill='none' style='background-color:#000' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> <g transform='translate(-320, 50) scale(0.6)'> <defs> <style> .cls-1 {fill: #6af3de;}</style> </defs> <polygon class='cls-1' points='439.37 225.54 286.25 225.54 220.62 645.55 592.5 645.55 610 523.05 391.25 523.05 439.37 225.54'/> <polyline class='cls-1' points='701.87 225.54 663.67 470.06 859.28 225.54'/> <polygon class='cls-1' points='819.01 470.07 663.67 470.07 636.25 645.55 793.12 645.55 819.01 470.07'/> <polyline class='cls-1' points='922.57 225.54 896.68 403.9 1049.15 403.9 856.4 645.55 968.04 645.55 968.05 645.65 1010.15 645.65 1031.5 513.28 1200.62 513.28 1218.12 403.9 1049.15 403.9 1058.15 348.04 1266.25 348.04 1283.75 225.54'/> <polygon class='cls-1' points='1310 225.54 1290.31 348.04 1406.25 348.04 1362.5 645.55 1520 645.55 1563.75 348.04 1686.25 348.04 1699.38 225.54 1310 225.54'/> </g> <text x='-150' y='630' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'>LIFT Node License Id: ",
            tokenId.toString(),
            "</text><text x='-150' y='700' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'>Owner: ",
            StringsUpgradeable.toHexString(uint160(ownerAddress)),
            "</text><text x='-150' y='770' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'># Licenses Owned by the Owner: ",
            balanceOf(ownerAddress).toString(),
            "</text><text font-size='15.5' fill='#fff' font-style='italic' font-family='Inter-n, sans-serif'><tspan x='-200' y='860'>Copyright 2024 LIFT Foundation</tspan> <tspan x='-200' y='900'>The Node Software is licensed under the LIFT license located at <a fill='#fff' xlink:href='https://www.liftdata.ai/lift-node-software-license'>https://www.liftdata.ai/lift-node-software-license</a> (&quot;License&quot;). </tspan> <tspan x='-200' y='920'>You may only use the Node Software in accordance with the conditions set forth in the License. </tspan>  <tspan x='-200' y='940'> You may obtain a copy of the Node Software at <a fill='#fff' xlink:href='https://www.liftdata.ai/node-download'>https://www.liftdata.ai/node-download</a>.</tspan></text></svg>")
        );
        string memory image = Base64Upgradeable.encode(bytes(svg));
        string memory json = Base64Upgradeable.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "License #',
                        tokenId.toString(),
                        '", "description": "LIFT Node License", "image": "data:image/svg+xml;base64,',
                        image,
                        '", "attributes": [{"trait_type": "Owner", "value": "',
                        StringsUpgradeable.toHexString(uint160(ownerAddress)),
                        '"}, {"trait_type": "Legal", "value": "Copyright 2024 LIFT Foundation. The Node Software is licensed under the LIFT license located at https://www.liftdata.ai/lift-node-software-license (License). You may only use the Node Software in accordance with the conditions set forth in the License. You may obtain a copy of the Node Software at https://www.liftdata.ai/node-download."}]}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /// @notice Mints a number of licenses to an address.
    /// @param account The account to mint the licenses to
    /// @param amount the amount of licenses to mint
    function mint(address account, uint256 amount) public override nonReentrant onlyLicenseManager {
        for (uint256 i = 0; i < amount; i++) {
            currentLicenseId++;
            _mint(account, currentLicenseId);
            emit LicenseMinted(account,currentLicenseId);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        if (from != address(0)) revert TransferNotAllowed(from, to, firstTokenId);
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721EnumerableUpgradeable, AccessControlUpgradeable, IERC165Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    modifier onlyLicenseManager() {
        if (!hasRole(LICENSE_MANAGER_ROLE, msg.sender)) revert AccessDenied();
        _;
    }
}
