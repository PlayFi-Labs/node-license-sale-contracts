// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IPlayFiLicenseSale.sol";

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


/// @title PlayFi node license sale contract
/// @author Archethect
/// @notice Contract used to handle whitelist and public node license sales in several tiers.
contract PlayFiLicenseSale is
Initializable,
AccessControlUpgradeable,
IPlayFiLicenseSale
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN");
    bytes32 public constant MERKLE_MANAGER_ROLE = keccak256("MERKLE_MANAGER");
    bytes32 public constant REFERRAL_MANAGER_ROLE = keccak256("REFERRAL_MANAGER");

    bytes32 public override teamMerkleRoot;
    bytes32 public override friendsFamilyMerkleRoot;
    bytes32 public override earlyAccessMerkleRoot;
    bytes32 public override partnerMerkleRoot;

    bool public override teamSaleActive;
    bool public override friendsFamilySaleActive;
    bool public override earlyAccessSaleActive;
    bool public override partnerSaleActive;
    bool public override publicSaleActive;

    uint256 public override standardCommissionPercentage;
    uint256 public override standardDiscountPercentage;
    uint256 public override totalLicenses;

    mapping(address => uint256) public teamClaimsPerAddress;
    mapping(address => uint256) public friendsFamilyClaimsPerAddress;
    mapping(address => uint256) public earlyAccessClaimsPerAddress;
    mapping(address => uint256) public partnerClaimsPerAddress;
    mapping(address => uint256) public publicClaimsPerAddress;

    mapping(uint256 => Tier) public tiers;
    mapping(string => Referral) public referrals;
    mapping(uint256 => mapping(address => uint256)) public claimsPerTierPerAddress;


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address guardian,
        address merkleManager,
        address referralManager
    ) public initializer {
        __AccessControl_init();

        if (admin == address(0)) revert InvalidAddress(admin);
        if (guardian == address(0)) revert InvalidAddress(guardian);
        if (merkleManager == address(0)) revert InvalidAddress(merkleManager);
        if (referralManager == address(0)) revert InvalidAddress(referralManager);

        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(GUARDIAN_ROLE, guardian);
        _grantRole(GUARDIAN_ROLE, admin);
        _setRoleAdmin(GUARDIAN_ROLE, ADMIN_ROLE);
        _grantRole(MERKLE_MANAGER_ROLE, merkleManager);
        _setRoleAdmin(MERKLE_MANAGER_ROLE, ADMIN_ROLE);
        _grantRole(REFERRAL_MANAGER_ROLE, referralManager);
        _setRoleAdmin(REFERRAL_MANAGER_ROLE, ADMIN_ROLE);

        standardCommissionPercentage = 5;
        standardDiscountPercentage = 5;
    }

    /// @notice Claims licenses for team members and make sure they do not exceed their personal claim cap.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify whether the caller is allowed to claim the licenses
    function claimLicenseTeam(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external {
        if(!teamSaleActive) revert TeamSaleNotActive();
        (uint256 index, uint256 claimCap) = abi.decode(data,(uint256,uint256));
        uint256 claimedLicenses = teamClaimsPerAddress[msg.sender];
        if(amount + claimedLicenses > claimCap) revert IndividualClaimCapExceeded();
        bytes32 node = keccak256(abi.encodePacked(index, msg.sender, claimCap));
        if (!MerkleProof.verify(merkleProof, teamMerkleRoot, node)) revert InvalidProof();
        teamClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        emit TeamLicensesClaimed(msg.sender, amount);
    }

    /// @notice Claims licenses for friends and family + make sure they do not exceed their personal claim cap and that
    /// they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify weather the caller is allowed to claim the licenses
    function claimLicenseFriendsFamily(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external payable {
        if(!friendsFamilySaleActive) revert FriendsFamilySaleNotActive();
        (uint256 index, uint256 claimCap) = abi.decode(data,(uint256,uint256));
        uint256 claimedLicenses = friendsFamilyClaimsPerAddress[msg.sender];
        if(amount + claimedLicenses > claimCap) revert IndividualClaimCapExceeded();
        bytes32 node = keccak256(abi.encodePacked(index, msg.sender, claimCap));
        if (!MerkleProof.verify(merkleProof, friendsFamilyMerkleRoot, node)) revert InvalidProof();
        uint256 toPay = tiers[1].price * amount;
        if(msg.value < toPay) revert InsufficientPayment();
        friendsFamilyClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        emit FriendsFamilyLicensesClaimed(msg.sender, amount);
    }

    /// @notice Claims licenses for early access addresses + make sure they do not exceed their personal claim cap and
    /// that they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify weather the caller is allowed to claim the licenses
    function claimLicenseEarlyAccess(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external payable {
        if(!earlyAccessSaleActive) revert EarlyAccessSaleNotActive();
        (uint256 index, uint256 claimCap) = abi.decode(data,(uint256,uint256));
        uint256 claimedLicenses = earlyAccessClaimsPerAddress[msg.sender];
        if(amount + claimedLicenses > claimCap) revert IndividualClaimCapExceeded();
        bytes32 node = keccak256(abi.encodePacked(index, msg.sender, claimCap));
        if (!MerkleProof.verify(merkleProof, earlyAccessMerkleRoot, node)) revert InvalidProof();
        uint256 toPay = tiers[1].price * amount;
        if(msg.value < toPay) revert InsufficientPayment();
        earlyAccessClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        emit EarlyAccessLicensesClaimed(msg.sender, amount);
    }

    /// @notice Claims licenses for partners + make sure they do not exceed their personal claim cap and that
    /// they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify weather the caller is allowed to claim the licenses
    function claimLicensePartner(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) external payable {
        if(!partnerSaleActive) revert PartnerSaleNotActive();
        (uint256 index, uint256 claimCap) = abi.decode(data,(uint256,uint256));
        uint256 claimedLicenses = partnerClaimsPerAddress[msg.sender];
        if(amount + claimedLicenses > claimCap) revert IndividualClaimCapExceeded();
        bytes32 node = keccak256(abi.encodePacked(index, msg.sender, claimCap));
        if (!MerkleProof.verify(merkleProof, partnerMerkleRoot, node)) revert InvalidProof();
        uint256 toPay = tiers[2].price * amount;
        if(msg.value < toPay) revert InsufficientPayment();
        partnerClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        emit PartnerLicensesClaimed(msg.sender, amount);
    }

    /// @notice Claims licenses for the public in a specific tier + make sure they do not exceed their personal claim
    /// cap and total tier cap. Additionally also make sure that they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param referral A referral code that can give discounts.
    function claimLicensePublic(uint256 amount, uint256 tier, string calldata referral) external payable {
        if(!publicSaleActive) revert PublicSaleNotActive();
        if(tiers[tier].totalClaimed + amount > tiers[tier].totalCap) revert TotalTierCapExceeded();
        if(claimsPerTierPerAddress[tier][msg.sender] + amount > tiers[tier].individualCap) revert IndividualTierCapExceeded();
        (uint256 toPay, uint256 commission,) = paymentDetailsForReferral(amount, tier, referral);
        if(msg.value < toPay) revert InsufficientPayment();
        if(commission > 0) {
            (bool sent, ) = payable(referrals[referral].receiver).call{ value: commission }("");
            if (!sent) revert CommissionPayoutFailed();
            emit CommissionPaid(referrals[referral].receiver, commission);
        }
        string memory addressAsString = Strings.toHexString(msg.sender);
        if(referrals[addressAsString].discountPercentage == 0) {
            _setReferral(addressAsString, msg.sender, standardCommissionPercentage, standardDiscountPercentage);
        }
        tiers[tier].totalClaimed += amount;
        publicClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        emit PublicLicensesClaimed(msg.sender, amount, tier, toPay);
    }
    /// @notice Calculates the price, commission and discount for X number of licenses in tier Y given referral code Z
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param referral A referral code that can give discounts.
    /// @return toPay The amount of ETH that should be paid by the claimer.
    /// @return commission The commission in ETH that the referrer will get.
    /// @return discount The discount in ETH the claimer will get
    function paymentDetailsForReferral(uint256 amount, uint256 tier, string calldata referral) public view returns (uint256 toPay, uint256 commission, uint256 discount) {
        uint256 fullPrice = tiers[tier].price * amount;
        discount = fullPrice * referrals[referral].discountPercentage / 100;
        commission = fullPrice * referrals[referral].commissionPercentage / 100;
        toPay = fullPrice - discount;
    }

    /// @notice Returns tier details provided a tier id
    /// @param id The tier id
    /// @return tier The tier
    function getTier(uint256 id) public view returns(Tier memory tier) {
        tier = tiers[id];
    }

    /// @notice Returns referral details provided a referral id
    /// @param id The referral id
    /// @return referral The referral
    function getReferral(string memory id) public view returns(Referral memory referral) {
        referral = referrals[id];
    }

    /// @notice Sets referral details
    /// @param code The referral code to be used when claiming
    /// @param receiver The receiver address for the commissions
    /// @param commission The percentage of the total price to be used as a commission
    /// @param discount The percentage of the total price to be used as a discount
    function setReferral(string memory code, address receiver, uint256 commission, uint256 discount) public onlyReferralManager {
        _setReferral(code, receiver, commission, discount);
    }

    /// @notice Sets tier details
    /// @param ids the ids of the tiers to set
    /// @param prices the prices of each tier to set
    /// @param individualCaps the maximum amount of licenses that can be claimed per address for the tiers.
    /// @param totalCaps the maximum amount of licenses that can be claimed in total for the tiers.
    function setTiers(uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) external onlyAdmin {
        if(ids.length != prices.length || prices.length != individualCaps.length || individualCaps.length != totalCaps.length) revert InvalidTierInputs();
        for (uint256 i = 0; i < ids.length; ) {
            tiers[ids[i]] = Tier(prices[i], individualCaps[i], tiers[ids[i]].totalClaimed, totalCaps[i]);
            emit TierSet(ids[i], prices[i], individualCaps[i], tiers[ids[i]].totalClaimed, totalCaps[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Sets the team sale merkle root
    /// @param _teamMerkleRoot The root of the team sale merkle tree
    function setTeamMerkleRoot(bytes32 _teamMerkleRoot) external onlyMerkleManager {
        teamMerkleRoot = _teamMerkleRoot;
        emit TeamMerkleRootSet(_teamMerkleRoot);
    }

    /// @notice Sets the friends and family sale merkle root
    /// @param _friendsFamilyMerkleRoot The root of the friends and family sale merkle tree
    function setFriendsFamilyMerkleRoot(bytes32 _friendsFamilyMerkleRoot) external onlyMerkleManager {
        friendsFamilyMerkleRoot = _friendsFamilyMerkleRoot;
        emit FriendsFamilyMerkleRootSet(_friendsFamilyMerkleRoot);
    }

    /// @notice Sets the early access sale merkle root
    /// @param _earlyAccessMerkleRoot The root of the early access sale merkle tree
    function setEarlyAccessMerkleRoot(bytes32 _earlyAccessMerkleRoot) external onlyMerkleManager {
        earlyAccessMerkleRoot = _earlyAccessMerkleRoot;
        emit EarlyAccessMerkleRootSet(_earlyAccessMerkleRoot);
    }

    /// @notice Sets the partner sale merkle root
    /// @param _partnerMerkleRoot The root of the partner sale merkle tree
    function setPartnerMerkleRoot(bytes32 _partnerMerkleRoot) external onlyMerkleManager {
        partnerMerkleRoot = _partnerMerkleRoot;
        emit PartnerMerkleRootSet(_partnerMerkleRoot);
    }

    /// @notice Sets the team sale status
    /// @param status The status to set for the team sale
    function setTeamSale(bool status) external onlyGuardian {
        teamSaleActive = status;
        emit TeamSaleStatusSet(status);
    }

    /// @notice Sets the friends and family sale status
    /// @param status The status to set for the friends and family sale
    function setFriendsFamilySale(bool status) external onlyGuardian {
        friendsFamilySaleActive = status;
        emit FriendsFamilySaleStatusSet(status);
    }

    /// @notice Sets the early access sale status
    /// @param status The status to set for the early access sale
    function setEarlyAccessSale(bool status) external onlyGuardian {
        earlyAccessSaleActive = status;
        emit EarlyAccessSaleStatusSet(status);
    }

    /// @notice Sets the partner sale status
    /// @param status The status to set for the partner sale
    function setPartnerSale(bool status) external onlyGuardian {
        partnerSaleActive = status;
        emit PartnerSaleStatusSet(status);
    }

    /// @notice Sets the public sale status
    /// @param status The status to set for the public sale
    function setPublicSale(bool status) external onlyGuardian {
        publicSaleActive = status;
        emit PublicSaleStatusSet(status);
    }

    /// @notice Withdraws the sale proceeds
    function withdrawProceeds() public onlyAdmin {
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{ value: amount }("");
        if (!sent) revert WithdrawalFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function _setReferral(string memory code, address receiver, uint256 commission, uint256 discount) internal {
        if(discount > 50) revert InvalidDiscount();
        if(commission > 50) revert InvalidCommission();
        referrals[code].discountPercentage = discount;
        referrals[code].commissionPercentage = commission;
        referrals[code].receiver = receiver;
        emit referralUpdated(code, receiver, commission, discount);
    }

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyMerkleManager() {
        if (!hasRole(MERKLE_MANAGER_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyReferralManager() {
        if (!hasRole(REFERRAL_MANAGER_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyGuardian() {
        if (!hasRole(GUARDIAN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }
}
