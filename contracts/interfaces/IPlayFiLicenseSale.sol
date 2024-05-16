// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


/*

                 .-+*###+-.
               =*%%%%%%%%%%#=:
               :=*%%%%%%%%%%%#+-.
                   .-+#%%%%%%%%%%%*=:
    :+##+-             :=#%%%%%%%%%%%#+-
   *%%%%%%%*=:            .-+#%%%%%%%%%%*.
  *%%%%%%%%#+:                :=#%%%%%%%%*
  #%%%%%%*:         .==:         .*%%%%%%%
  #%%%%%%=       :+#%%%%#+-       -%%%%#+:
  #%%%%%%=     :#%%%%%%%%%%#-     -%*=.
  #%%%%%%=     -%%%%%%%%%%%%=     .
  #%%%%%%=     -%%%%%%%%%%%%=
  #%%%%%%=     -%%%%%%%%%%%%=            :
  #%%%%%%=      .=*%%%%%%*=:         .-+#%
  #%%%%%%=          -++-.         :=#%%%%%
  *%%%%%%=                    .-+#%%%%%%%#
  .#%%%%%=                 :=*%%%%%%%%%%#:
    =*%%%=       #+-.  .-+#%%%%%%%%%%%*=
       -+=       #%%%##%%%%%%%%%%%#*-.
                 #%%%%%%%%%%%%%#=:
                 #%%%%%%%%%#*-.
                 :=*%%%%#=:

*/



interface IPlayFiLicenseSale
{
    struct Tier {
        uint256 price;
        uint256 individualCap;
        uint256 totalClaimed;
        uint256 totalCap;
    }

    struct Referral {
        uint256 discountPercentage;
        uint256 commissionPercentage;
        address receiver;
    }

    event TeamLicensesClaimed(address indexed account, uint256 amount);
    event FriendsFamilyLicensesClaimed(address indexed account, uint256 paid, uint256 amount);
    event EarlyAccessLicensesClaimed(address indexed account, uint256 paid, uint256 amount);
    event PartnerLicensesClaimed(address indexed account, uint256 amount, uint256 indexed tier, uint256 paid, string partnerCode, string referral);
    event CommissionPaid(string code, address indexed receiver, uint256 amount);
    event PublicLicensesClaimed(address indexed account, uint256 amount, uint256 indexed tier, uint256 paid, string referral);
    event PublicWhitelistLicensesClaimed(address indexed account, uint256 amount, uint256 indexed tier, uint256 paid, string referral);
    event ReferralUpdated(string code, address indexed receiver, uint256 commission, uint256 discount);
    event TeamMerkleRootSet(bytes32 merkleRoot);
    event FriendsFamilyMerkleRootSet(bytes32 merkleRoot);
    event EarlyAccessMerkleRootSet(bytes32 merkleRoot);
    event PartnerMerkleRootSet(bytes32 merkleRoot);
    event PublicMerkleRootSet(bytes32 merkleRoot);
    event TeamSaleStatusSet(bool status);
    event FriendsFamilySaleStatusSet(bool status);
    event EarlyAccessSaleStatusSet(bool status);
    event PartnerSaleStatusSet(bool status, string partnerCode);
    event PublicSaleStatusSet(bool status);
    event ProceedsWithdrawn(address indexed receiver, uint256 amount);
    event TierSet(uint256 indexed tierId, uint256 price, uint256 individualCap, uint256 totalClaimed, uint256 totalCap);
    event WhitelistTierSet(uint256 indexed tierId, uint256 price, uint256 individualCap, uint256 totalClaimed, uint256 totalCap);
    event PartnerTierSet(string partnerCode, uint256 indexed tierId, uint256 price, uint256 individualCap, uint256 totalClaimed, uint256 totalCap);
    event ContractInitialized();

    error InvalidAddress(address account);
    error TeamSaleNotActive();
    error IndividualClaimCapExceeded();
    error InvalidProof();
    error FriendsFamilySaleNotActive();
    error InsufficientPayment();
    error EarlyAccessSaleNotActive();
    error PartnerSaleNotActive();
    error PublicSaleNotActive();
    error TotalTierCapExceeded();
    error IndividualTierCapExceeded();
    error CommissionPayoutFailed();
    error WithdrawalFailed();
    error InvalidTierInputs();
    error AccessDenied();
    error InvalidDiscount();
    error InvalidCommission();

    function claimLicenseTeam(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external;

    function claimLicenseFriendsFamily(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external payable;

    function claimLicenseEarlyAccess(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external payable;

    function claimLicensePartner(uint256 amount,  uint256 tier, string memory partnerCode, string memory referral) external payable;

    function claimLicensePublic(uint256 amount, uint256 tier, string calldata referral) external payable;

    function paymentDetailsForReferral(uint256 amount, uint256 tier, string calldata referral, bool isWhitelist) external view returns (uint256 toPay, uint256 commission, uint256 discount);

    function paymentDetailsForPartnerReferral(uint256 amount, uint256 tier, string calldata partnerCode, string calldata referral) external view returns (uint256 toPay, uint256 commission, uint256 discount);

    function getTier(uint256 id, bool isWhitelist) external view returns(Tier memory tier);

    function getPartnerTier(string calldata partnerCode, uint256 id) external view returns(Tier memory tier);

    function getReferral(string memory id) external view returns(Referral memory referral);

    function setReferral(string memory code, address receiver, uint256 commission, uint256 discount) external;

    function setTeamMerkleRoot(bytes32 _teamMerkleRoot) external;

    function setFriendsFamilyMerkleRoot(bytes32 _friendsFamilyMerkleRoot) external;

    function setEarlyAccessMerkleRoot(bytes32 _earlyAccessMerkleRoot) external;

    function setPublicMerkleRoot(bytes32 _publicMerkleRoot) external;

    function setTeamSale(bool status) external;

    function setFriendsFamilySale(bool status) external;

    function setEarlyAccessSale(bool status) external;

    function setPartnerSale(string memory partnerCode, bool status) external;

    function setPublicSale(bool status) external;

    function setTiers(uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) external;

    function setWhitelistTiers(uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) external;

    function setPartnerTiers(string[] calldata partnerCodes, uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) external;

    function teamMerkleRoot() external view returns (bytes32);

    function friendsFamilyMerkleRoot() external view returns (bytes32);

    function earlyAccessMerkleRoot() external view returns (bytes32);

    function publicMerkleRoot() external view returns (bytes32);

    function teamSaleActive() external view returns (bool);

    function friendsFamilySaleActive() external view returns (bool);

    function earlyAccessSaleActive() external view returns (bool);

    function partnerSaleActive(string calldata) external view returns (bool);

    function publicSaleActive() external view returns (bool);

    function standardCommissionPercentage() external view returns (uint256);

    function standardDiscountPercentage() external view returns (uint256);

    function totalLicenses() external view returns (uint256);

}
