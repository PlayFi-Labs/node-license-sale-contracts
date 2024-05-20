// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IPreOrderLicenseClaimer.sol";
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


/// @title PlayFi License Claimer for Pre-Sales
/// @author Archethect
/// @notice Contract used to claim licenses for pre-orders
contract PreOrderLicenseClaimer is
Initializable,
AccessControlUpgradeable,
IPreOrderLicenseClaimer
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR");

    IPlayFiLicenseSale public licenseSale;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address executor,
        address _licenseSale
    ) public initializer {
        __AccessControl_init();

        if (admin == address(0)) revert InvalidAddress(admin);
        if (executor == address(0)) revert InvalidAddress(executor);
        if (_licenseSale == address(0)) revert InvalidAddress(_licenseSale);

        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(EXECUTOR_ROLE, executor);
        _grantRole(EXECUTOR_ROLE, admin);
        _setRoleAdmin(EXECUTOR_ROLE, ADMIN_ROLE);

        licenseSale = IPlayFiLicenseSale(_licenseSale);
    }

    /// @notice Claims pre-orders with the funds collected during the presale given the amounts per tier and the tiers
    /// @param amounts The amounts of licenses to claim per tier
    /// @param tiers The tiers to claim from
    function claimPreOrders(uint256[] calldata amounts,uint256[] calldata tiers) public onlyExecutor {
        if(amounts.length != tiers.length) revert InvalidLength();
        for (uint256 i = 0; i < amounts.length; ) {
            (uint256 toPay,,) = licenseSale.paymentDetailsForReferral(amounts[i],tiers[i],"",false);
            licenseSale.claimLicensePublic{ value: toPay }(amounts[i],tiers[i],"");
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Withdraws the contract balance
    function withdraw() public onlyAdmin {
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{ value: amount }("");
        if (!sent) revert WithdrawalFailed();
        emit Withdrawn(msg.sender, amount);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier onlyExecutor() {
        if (!hasRole(EXECUTOR_ROLE, msg.sender)) revert AccessDenied();
        _;
    }
}
