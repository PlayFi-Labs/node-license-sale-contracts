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

    function paymentDetailsForReferral(uint256 amount, uint256 tier, string calldata referral) public view returns (uint256 toPay, uint256 commission, uint256 discount) {
        uint256 fullPrice = tiers[tier].price * amount;
        discount = fullPrice * referrals[referral].discountPercentage / 100;
        commission = fullPrice * referrals[referral].commissionPercentage / 100;
        toPay = fullPrice - discount;
    }

    function getTier(uint256 id) public view returns(Tier memory tier) {
        tier = tiers[id];
    }

    function getReferral(string memory id) public view returns(Referral memory referral) {
        referral = referrals[id];
    }

    function setReferral(string memory code, address receiver, uint256 commission, uint256 discount) public onlyReferralManager {
        _setReferral(code, receiver, commission, discount);
    }

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

    function setTeamMerkleRoot(bytes32 _teamMerkleRoot) external onlyMerkleManager {
        teamMerkleRoot = _teamMerkleRoot;
        emit TeamMerkleRootSet(_teamMerkleRoot);
    }

    function setFriendsFamilyMerkleRoot(bytes32 _friendsFamilyMerkleRoot) external onlyMerkleManager {
        friendsFamilyMerkleRoot = _friendsFamilyMerkleRoot;
        emit FriendsFamilyMerkleRootSet(_friendsFamilyMerkleRoot);
    }

    function setEarlyAccessMerkleRoot(bytes32 _earlyAccessMerkleRoot) external onlyMerkleManager {
        earlyAccessMerkleRoot = _earlyAccessMerkleRoot;
        emit EarlyAccessMerkleRootSet(_earlyAccessMerkleRoot);
    }

    function setPartnerMerkleRoot(bytes32 _partnerMerkleRoot) external onlyMerkleManager {
        partnerMerkleRoot = _partnerMerkleRoot;
        emit PartnerMerkleRootSet(_partnerMerkleRoot);
    }

    function setTeamSale(bool status) external onlyGuardian {
        teamSaleActive = status;
        emit TeamSaleStatusSet(status);
    }

    function setFriendsFamilySale(bool status) external onlyGuardian {
        friendsFamilySaleActive = status;
        emit FriendsFamilySaleStatusSet(status);
    }

    function setEarlyAccessSale(bool status) external onlyGuardian {
        earlyAccessSaleActive = status;
        emit EarlyAccessSaleStatusSet(status);
    }

    function setPartnerSale(bool status) external onlyGuardian {
        partnerSaleActive = status;
        emit PartnerSaleStatusSet(status);
    }

    function setPublicSale(bool status) external onlyGuardian {
        publicSaleActive = status;
        emit PublicSaleStatusSet(status);
    }

    function withdrawProceeds() public onlyAdmin {
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{ value: amount }("");
        if (!sent) revert WithdrawalFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function _setReferral(string memory code, address receiver, uint256 commission, uint256 discount) internal {
        referrals[code].discountPercentage == discount;
        referrals[code].commissionPercentage == commission;
        referrals[code].receiver == receiver;
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
