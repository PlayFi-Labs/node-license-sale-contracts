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
        __ERC721_init("PlayFi Node License", "PLAYFI_NODE_LICENSE");
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
            "<svg width='500' height='500' viewBox='-250 -30 1000 1000' fill='none' style='background-color:#000' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><text x='-150' y='630' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'>PlayFi Node License Id: ",
            tokenId.toString(),
            "</text><text x='-150' y='700' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'>Owner: ",
            StringsUpgradeable.toHexString(uint160(ownerAddress)),
            "</text><text x='-150' y='770' font-size='30' fill='#fff' font-family='Inter-n, sans-serif'># Licenses Owned by the Owner: ",
            balanceOf(ownerAddress).toString(),
            "</text><text font-size='15.5' fill='#fff' font-style='italic' font-family='Inter-n, sans-serif'><tspan x='-200' y='860'>Copyright 2024 PlayFI Foundation</tspan> <tspan x='-200' y='900'>The Node Software is licensed under the PlayFi license located at <a fill='#fff' xlink:href='https://www.playfi.ai/playfi-node-software-license'>https://www.playfi.ai/playfi-node-software-license</a> (&quot;License&quot;). </tspan> <tspan x='-200' y='920'>You may only use the Node Software in accordance with the conditions set forth in the License. </tspan>  <tspan x='-200' y='940'> You may obtain a copy of the Node Software at [insert URL].</tspan></text><path d='M413.192 376.075 238.19 477.112l-34.411-19.867v72.964l34.411 19.868 238.19-137.52V137.519L238.19 0 0 137.519v275.038l169.368 97.785V235.303l68.821-39.734 68.821 39.734v79.468l-68.821 39.734-34.411-19.867v72.964l34.411 19.867 132.01-76.216V198.821l-132.01-76.216-132.01 76.216v202.075l-42.99-24.821V174.001L238.19 72.964l175.002 101.037z' fill='#fff'/><path d='M413.192 376.075 238.19 477.112l-34.411-19.867v72.964l34.411 19.868 238.19-137.52V137.519L238.19 0 0 137.519v275.038l169.368 97.785V235.303l68.821-39.734 68.821 39.734v79.468l-68.821 39.734-34.411-19.867v72.964l34.411 19.867 132.01-76.216V198.821l-132.01-76.216-132.01 76.216v202.075l-42.99-24.821V174.001L238.19 72.964l175.002 101.037z' fill='url(#a)'/><defs><linearGradient id='a' x1='488.389' y1='8.131' x2='-179.044' y2='489.909' gradientUnits='userSpaceOnUse'><stop stop-color='#FFE70F'/><stop offset='.374' stop-color='#FF4DD8'/><stop offset='.806' stop-color='#4685FF'/></linearGradient></defs></svg>")
        );
        string memory image = Base64Upgradeable.encode(bytes(svg));
        string memory json = Base64Upgradeable.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "License #',
                        tokenId.toString(),
                        '", "description": "PlayFi Node License", "image": "data:image/svg+xml;base64,',
                        image,
                        '", "attributes": [{"trait_type": "Owner", "value": "',
                        StringsUpgradeable.toHexString(uint160(ownerAddress)),
                        '"}, {"trait_type": "Legal", "value": "Copyright 2024 PlayFI Foundation. The Node Software is licensed under the PlayFi license located at https://www.playfi.ai/playfi-node-software-license ("License"). You may only use the Node Software in accordance with the conditions set forth in the License. You may obtain a copy of the Node Software at [insert URL]."}]}'
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
