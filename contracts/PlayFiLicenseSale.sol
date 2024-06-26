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
    using Strings for string;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN");
    bytes32 public constant MERKLE_MANAGER_ROLE = keccak256("MERKLE_MANAGER");
    bytes32 public constant REFERRAL_MANAGER_ROLE = keccak256("REFERRAL_MANAGER");

    bytes32 public override teamMerkleRoot;
    bytes32 public override friendsFamilyMerkleRoot;
    bytes32 public override earlyAccessMerkleRoot;
    bytes32 public override publicMerkleRoot;

    bool public override teamSaleActive;
    bool public override friendsFamilySaleActive;
    bool public override earlyAccessSaleActive;
    bool public override publicSaleActive;
    bool public override publicWhitelistSaleActive;

    uint256 public override totalLicenses;

    mapping(address => uint256) public teamClaimsPerAddress;
    mapping(address => uint256) public friendsFamilyClaimsPerAddress;
    mapping(address => uint256) public earlyAccessClaimsPerAddress;
    mapping(string => mapping(address => uint256)) public partnerClaimsPerAddress;
    mapping(address => uint256) public publicClaimsPerAddress;
    mapping(address => mapping(string => uint256)) public publicWhitelistClaimsPerAddressAndReferral;

    mapping(uint256 => Tier) public tiers;
    mapping(uint256 => Tier) public whitelistTiers;
    mapping(string => mapping(uint256 => Tier)) public partnerTiers;
    mapping(string => Referral) public referrals;
    mapping(address => string) public receiverToReferralCode;
    mapping(uint256 => mapping(address => uint256)) public claimsPerTierPerAddress;
    mapping(string => mapping(uint256 => mapping(address => uint256))) public partnerClaimsPerTierPerAddress;
    mapping(string => bool) public partnerSaleActive;
    mapping(string => Referral) public partnerReferrals;

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

        emit ContractInitialized();
    }

    /// @notice Claims licenses for team members and make sure they do not exceed their personal claim cap.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify whether the caller is allowed to claim the licenses
    function claimLicenseTeam(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) public {
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
    function claimLicenseFriendsFamily(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) public payable {
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
        emit FriendsFamilyLicensesClaimed(msg.sender, toPay, amount);
    }

    /// @notice Claims licenses for early access addresses + make sure they do not exceed their personal claim cap and
    /// that they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param data Index and claimCap in encoded format
    /// @param merkleProof The proof used to verify whether the caller is allowed to claim the licenses
    function claimLicenseEarlyAccess(uint256 amount, bytes calldata data, bytes32[] calldata merkleProof) public payable {
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
        emit EarlyAccessLicensesClaimed(msg.sender, toPay, amount);
    }

    /// @notice Claims licenses for partners + make sure they do not exceed their personal claim cap and that
    /// they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param partnerCode The code of the partner sale
    function claimLicensePartner(uint256 amount,  uint256 tier, string memory partnerCode, string memory referral) public payable {
        if(!partnerSaleActive[partnerCode]) revert PartnerSaleNotActive();
        if(partnerTiers[partnerCode][tier].totalClaimed + amount > partnerTiers[partnerCode][tier].totalCap) revert TotalTierCapExceeded();
        if(partnerClaimsPerTierPerAddress[partnerCode][tier][msg.sender] + amount > partnerTiers[partnerCode][tier].individualCap) revert IndividualTierCapExceeded();
        (uint256 toPay, uint256 commission,) = paymentDetailsForPartnerReferral(amount, tier, partnerCode, referral);
        if(msg.value < toPay) revert InsufficientPayment();
        if(partnerReferrals[partnerCode].receiver != address(0)) {
            if(commission > 0) {
                (bool sent, ) = payable(partnerReferrals[partnerCode].receiver).call{ value: commission }("");
                if (!sent) revert CommissionPayoutFailed();
                emit CommissionPaid(partnerCode, partnerReferrals[partnerCode].receiver, commission);
            }
        } else {
            if(commission > 0) {
                (bool sent, ) = payable(referrals[referral].receiver).call{ value: commission }("");
                if (!sent) revert CommissionPayoutFailed();
                emit CommissionPaid(referral, referrals[referral].receiver, commission);
            }
            referrals[referral].totalClaims += amount;
        }
        partnerReferrals[partnerCode].totalClaims += amount;
        partnerTiers[partnerCode][tier].totalClaimed += amount;
        partnerClaimsPerAddress[partnerCode][msg.sender] += amount;
        totalLicenses += amount;
        emit PartnerLicensesClaimed(msg.sender, amount, tier, toPay, partnerCode, referral);
    }

    /// @notice Claims licenses for the public in a specific tier + make sure they do not exceed their personal claim
    /// cap and total tier cap. Additionally also make sure that they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param referral A referral code that can give discounts.
    function claimLicensePublic(uint256 amount, uint256 tier, string memory referral) public payable {
        if(!publicSaleActive) revert PublicSaleNotActive();
        if(tiers[tier].totalClaimed + amount > tiers[tier].totalCap) revert TotalTierCapExceeded();
        if(claimsPerTierPerAddress[tier][msg.sender] + amount > tiers[tier].individualCap) revert IndividualTierCapExceeded();
        (uint256 toPay, uint256 commission,) = paymentDetailsForReferral(amount, tier, referral, false);
        if(msg.value < toPay) revert InsufficientPayment();
        if(commission > 0) {
            (bool sent, ) = payable(referrals[referral].receiver).call{ value: commission }("");
            if (!sent) revert CommissionPayoutFailed();
            emit CommissionPaid(referral, referrals[referral].receiver, commission);
        }
        tiers[tier].totalClaimed += amount;
        publicClaimsPerAddress[msg.sender] += amount;
        totalLicenses += amount;
        referrals[referral].totalClaims += amount;
        emit PublicLicensesClaimed(msg.sender, amount, tier, toPay, referral);
    }

    /// @notice Claims licenses for whitelisted addresses during the public sale + make sure they do not exceed their personal claim cap and that
    /// they paid enough.
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param data Index, claimCap and referral in encoded format
    /// @param merkleProof The proof used to verify weather the caller is allowed to claim the licenses
    function claimLicensePublicWhitelist(uint256 amount, uint256 tier, bytes calldata data, bytes32[] calldata merkleProof) public payable {
        if(!publicWhitelistSaleActive) revert PublicWhitelistSaleNotActive();
        (uint256 index, uint256 claimCap, string memory referral) = abi.decode(data,(uint256,uint256,string));
        if(whitelistTiers[tier].totalClaimed + amount > whitelistTiers[tier].totalCap) revert TotalTierCapExceeded();
        uint256 claimedLicenses = publicWhitelistClaimsPerAddressAndReferral[msg.sender][referral];
        if(amount + claimedLicenses > claimCap) revert IndividualClaimCapExceeded();
        {
            bytes32 node = keccak256(abi.encodePacked(index, msg.sender, claimCap, referral));
            if (!MerkleProof.verify(merkleProof, publicMerkleRoot, node)) revert InvalidProof();
        }
        (uint256 toPay, uint256 commission,) = paymentDetailsForReferral(amount, tier, referral, true);
        if(msg.value < toPay) revert InsufficientPayment();
        if(commission > 0) {
            (bool sent, ) = payable(referrals[referral].receiver).call{ value: commission }("");
            if (!sent) revert CommissionPayoutFailed();
            emit CommissionPaid(referral, referrals[referral].receiver, commission);
        }
        whitelistTiers[tier].totalClaimed += amount;
        publicWhitelistClaimsPerAddressAndReferral[msg.sender][referral] += amount;
        totalLicenses += amount;
        referrals[referral].totalClaims += amount;
        emit PublicWhitelistLicensesClaimed(msg.sender, amount, tier, toPay, referral);
    }

    /// @notice Calculates the price, commission and discount for X number of licenses in tier Y given referral code Z
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param referral A referral code that can give discounts.
    /// @param isWhitelist Whether the tier is used for the whitelist sale or not
    /// @return toPay The amount of ETH that should be paid by the claimer.
    /// @return commission The commission in ETH that the referrer will get.
    /// @return discount The discount in ETH the claimer will get
    function paymentDetailsForReferral(uint256 amount, uint256 tier, string memory referral, bool isWhitelist) public view returns (uint256 toPay, uint256 commission, uint256 discount) {
        uint256 tierPrice;
        if(isWhitelist) {
            tierPrice = whitelistTiers[tier].price;
        } else {
            tierPrice = tiers[tier].price;
        }
        uint256 fullPrice = tierPrice * amount;
        if(referrals[referral].receiver != address(0)) {
            uint256 totalClaims = referrals[referral].totalClaims;
            if(totalClaims < 20) {
                commission = fullPrice * 10 / 100;
            } else if (totalClaims < 40) {
                commission = fullPrice * 11 / 100;
            } else if (totalClaims < 60) {
                commission = fullPrice * 12 / 100;
            } else if (totalClaims < 80) {
                commission = fullPrice * 13 / 100;
            } else if (totalClaims < 100) {
                commission = fullPrice * 14 / 100;
            } else {
                commission = fullPrice * 15 / 100;
            }
            discount = commission;
        }
        toPay = fullPrice - discount;
    }

    /// @notice Calculates the price, commission and discount for X number of licenses in partner tier Y given partnerCod Z
    /// @param amount The amount of licenses to claim
    /// @param tier The tier to buy the licenses from
    /// @param partnerCode The code identifying the partner sale
    /// @return toPay The amount of ETH that should be paid by the claimer.
    /// @return commission The commission in ETH that the referrer will get.
    /// @return discount The discount in ETH the claimer will get
    function paymentDetailsForPartnerReferral(uint256 amount, uint256 tier, string memory partnerCode, string memory referral) public view returns (uint256 toPay, uint256 commission, uint256 discount) {
        uint256 tierPrice = partnerTiers[partnerCode][tier].price;
        uint256 fullPrice = tierPrice * amount;
        bool isSmallPartner =  partnerReferrals[partnerCode].receiver != address(0) ? true : false;
        if(isSmallPartner || referrals[referral].receiver != address(0)) {
            uint256 totalClaims = isSmallPartner ? partnerReferrals[partnerCode].totalClaims : referrals[referral].totalClaims;
            if(totalClaims < 20) {
                commission = fullPrice * 10 / 100;
            } else if (totalClaims < 40) {
                commission = fullPrice * 11 / 100;
            } else if (totalClaims < 60) {
                commission = fullPrice * 12 / 100;
            } else if (totalClaims < 80) {
                commission = fullPrice * 13 / 100;
            } else if (totalClaims < 100) {
                commission = fullPrice * 14 / 100;
            } else {
                commission = fullPrice * 15 / 100;
            }
            discount = commission;
        }
        toPay = fullPrice - discount;
    }

    /// @notice Returns tier details provided a tier id
    /// @param id The tier id
    /// @param isWhitelist Whether the tier is used for the whitelist sale or not
    /// @return tier The tier
    function getTier(uint256 id, bool isWhitelist) public view returns(Tier memory tier) {
        if(isWhitelist) {
            tier = tiers[id];
        } else {
            tier = whitelistTiers[id];
        }
    }

    /// @notice Returns partner tier details provided a partner code and tier id
    /// @param partnerCode The code of the partner to return the tier from
    /// @param id The tier id
    /// @return tier The tier
    function getPartnerTier(string calldata partnerCode, uint256 id) public view returns(Tier memory tier) {
        tier = partnerTiers[partnerCode][id];
    }

    /// @notice Returns referral details provided a referral id
    /// @param id The referral id
    /// @return referral The referral
    function getReferral(string memory id) public view returns(Referral memory referral) {
        referral = referrals[id];
    }

    /// @notice Sets referral details
    /// @param code The referral code to be used when claiming
    function setReferral(string memory code) public {
        _setReferral(code, msg.sender);
    }

    /// @notice Sets referral details for a specific receiver
    /// @param code The referral code to be used when claiming
    /// @param receiver The receiver address for the commissions
    function setReferralForReceiver(string memory code, address receiver) public onlyReferralManager {
        _setReferral(code, receiver);
    }

    /// @notice Sets tier details
    /// @param ids The ids of the tiers to set
    /// @param prices The prices of each tier to set
    /// @param individualCaps The maximum amount of licenses that can be claimed per address for the tiers.
    /// @param totalCaps The maximum amount of licenses that can be claimed in total for the tiers.
    function setTiers(uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) public onlyAdmin {
        if(ids.length != prices.length || prices.length != individualCaps.length || individualCaps.length != totalCaps.length) revert InvalidTierInputs();
        for (uint256 i = 0; i < ids.length; ) {
            uint256 totalClaimed = tiers[ids[i]].totalClaimed;
            tiers[ids[i]] = Tier(prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            emit TierSet(ids[i], prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Sets whitelist tier details
    /// @param ids The ids of the tiers to set
    /// @param prices The prices of each tier to set
    /// @param individualCaps The maximum amount of licenses that can be claimed per address for the tiers.
    /// @param totalCaps The maximum amount of licenses that can be claimed in total for the tiers.
    function setWhitelistTiers(uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) public onlyAdmin {
        if(ids.length != prices.length || prices.length != individualCaps.length || individualCaps.length != totalCaps.length) revert InvalidTierInputs();
        for (uint256 i = 0; i < ids.length; ) {
            uint256 totalClaimed = whitelistTiers[ids[i]].totalClaimed;
            whitelistTiers[ids[i]] = Tier(prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            emit WhitelistTierSet(ids[i], prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Sets partner tier details
    /// @param partnerCodes The codes of the partners to configure the tiers for
    /// @param ids The ids of the tiers to set
    /// @param prices The prices of each tier to set
    /// @param individualCaps The maximum amount of licenses that can be claimed per address for the tiers.
    /// @param totalCaps The maximum amount of licenses that can be claimed in total for the tiers.
    function setPartnerTiers(string[] calldata partnerCodes, uint256[] calldata ids, uint256[] calldata prices, uint256[] calldata individualCaps, uint256[] calldata totalCaps) public onlyAdmin {
        if(partnerCodes.length != ids.length || ids.length != prices.length || prices.length != individualCaps.length || individualCaps.length != totalCaps.length) revert InvalidTierInputs();
        for (uint256 i = 0; i < ids.length; ) {
            uint256 totalClaimed = partnerTiers[partnerCodes[i]][ids[i]].totalClaimed;
            partnerTiers[partnerCodes[i]][ids[i]] = Tier(prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            emit PartnerTierSet(partnerCodes[i],ids[i], prices[i], individualCaps[i], totalClaimed, totalCaps[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Sets the team sale merkle root
    /// @param _teamMerkleRoot The root of the team sale merkle tree
    function setTeamMerkleRoot(bytes32 _teamMerkleRoot) public onlyMerkleManager {
        teamMerkleRoot = _teamMerkleRoot;
        emit TeamMerkleRootSet(_teamMerkleRoot);
    }

    /// @notice Sets the friends and family sale merkle root
    /// @param _friendsFamilyMerkleRoot The root of the friends and family sale merkle tree
    function setFriendsFamilyMerkleRoot(bytes32 _friendsFamilyMerkleRoot) public onlyMerkleManager {
        friendsFamilyMerkleRoot = _friendsFamilyMerkleRoot;
        emit FriendsFamilyMerkleRootSet(_friendsFamilyMerkleRoot);
    }

    /// @notice Sets the early access sale merkle root
    /// @param _earlyAccessMerkleRoot The root of the early access sale merkle tree
    function setEarlyAccessMerkleRoot(bytes32 _earlyAccessMerkleRoot) public onlyMerkleManager {
        earlyAccessMerkleRoot = _earlyAccessMerkleRoot;
        emit EarlyAccessMerkleRootSet(_earlyAccessMerkleRoot);
    }

    /// @notice Sets the public sale merkle root
    /// @param _publicMerkleRoot The root of the public sale merkle tree
    function setPublicMerkleRoot(bytes32 _publicMerkleRoot) public onlyMerkleManager {
        publicMerkleRoot = _publicMerkleRoot;
        emit PublicMerkleRootSet(_publicMerkleRoot);
    }

    /// @notice Sets the team sale status
    /// @param status The status to set for the team sale
    function setTeamSale(bool status) public onlyGuardian {
        teamSaleActive = status;
        emit TeamSaleStatusSet(status);
    }

    /// @notice Sets the friends and family sale status
    /// @param status The status to set for the friends and family sale
    function setFriendsFamilySale(bool status) public onlyGuardian {
        friendsFamilySaleActive = status;
        emit FriendsFamilySaleStatusSet(status);
    }

    /// @notice Sets the early access sale status
    /// @param status The status to set for the early access sale
    function setEarlyAccessSale(bool status) public onlyGuardian {
        earlyAccessSaleActive = status;
        emit EarlyAccessSaleStatusSet(status);
    }

    /// @notice Sets the partner sale status
    /// @param partnerCode The code of the partner sale to set the status from
    /// @param status The status to set for the partner sale
    function setPartnerSale(string memory partnerCode, bool status) public onlyGuardian {
        partnerSaleActive[partnerCode] = status;
        emit PartnerSaleStatusSet(status, partnerCode);
    }

    /// @notice Sets the partner receiver address
    /// @param partnerCode The code of the partner sale to set the status from
    /// @param receiver The receiver address of the partner
    function setPartnerReceiverAddress(string memory partnerCode, address receiver) public onlyAdmin {
        partnerReferrals[partnerCode].receiver = receiver;
        emit PartnerReceiverAddressSet(partnerCode, receiver);
    }

    /// @notice Sets the public sale status
    /// @param status The status to set for the public sale
    function setPublicSale(bool status) public onlyGuardian {
        publicSaleActive = status;
        emit PublicSaleStatusSet(status);
    }

    /// @notice Sets the public whitelist sale status
    /// @param status The status to set for the public whitelist sale
    function setPublicWhitelistSale(bool status) public onlyGuardian {
        publicWhitelistSaleActive = status;
        emit PublicWhitelistSaleStatusSet(status);
    }

    /// @notice Withdraws the sale proceeds
    function withdrawProceeds() public onlyAdmin {
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{ value: amount }("");
        if (!sent) revert WithdrawalFailed();
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function _setReferral(string memory code, address receiver) internal {
        if(referrals[code].receiver != address(0)) revert ReferralCodeInUse();
        if(code.equal("")) revert InvalidCode();
        string memory oldReferralCode = receiverToReferralCode[receiver];
        uint256 totalClaims = 0;
        if(!oldReferralCode.equal("")) {
            totalClaims = referrals[receiverToReferralCode[receiver]].totalClaims;
            delete referrals[receiverToReferralCode[receiver]];
        }
        referrals[code].receiver = receiver;
        referrals[code].totalClaims = totalClaims;
        receiverToReferralCode[receiver] = code;
        emit ReferralUpdated(code, receiver);
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
