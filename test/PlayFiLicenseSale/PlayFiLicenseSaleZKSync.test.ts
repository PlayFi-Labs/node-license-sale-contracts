import hre, { ethers } from "hardhat";
import { Contracts, setupIntegration } from "../_helpers/zksync/index";
import { expect } from "chai";
import { User } from "../_helpers/zksync";
import {PlayFiLicenseSale} from "../../typechain";
import ClaimsTree from "../../scripts/merkle-tree/claims-tree";
import {Provider, Wallet} from "zksync-ethers";
import {impersonate} from "../_helpers/accounts";
import {Deployer} from "@matterlabs/hardhat-zksync";

const ONE_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000001'


describe("PlayFiLicenseSale", () => {
  let contracts: Contracts;
  let provider: Provider;
  let deployer: User;
  let deployerMultisig: User;
  let admin: User;
  let guardian: User;
  let merkleManager: User;
  let referralManager: User;
  let users: User[];

  beforeEach(async () => {
    ({ contracts, provider, deployer, deployerMultisig, admin, guardian, merkleManager, referralManager, users } =
      await setupIntegration());
  });

  describe("Contract Functionality", async function () {

    it("initializing the contract sets the correct on-chain states", async function () {
        const contractName = "PlayFiLicenseSale";
        const PRIVATE_KEY = process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY !== undefined ? process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY : "";
        const zkWallet = new Wallet(PRIVATE_KEY,provider);
        const deployerAccount = new Deployer(hre, zkWallet);
        const contract = await deployerAccount.loadArtifact(contractName);
      const playFiLicenseSale = await hre.zkUpgrades.deployProxy(deployerAccount.zkWallet, contract, [
        admin.address,
        guardian.address, merkleManager.address, referralManager.address
      ], { initializer: "initialize" }) as unknown as PlayFiLicenseSale;
      await playFiLicenseSale.waitForDeployment()
      expect(await playFiLicenseSale.standardCommissionPercentage()).to.be.equal(5);
      expect(await playFiLicenseSale.standardDiscountPercentage()).to.be.equal(5);
      const adminRole = await playFiLicenseSale.ADMIN_ROLE();
      const guardianRole = await playFiLicenseSale.GUARDIAN_ROLE();
      const merkleManagerRole = await playFiLicenseSale.MERKLE_MANAGER_ROLE();
      const referralManagerRole = await  playFiLicenseSale.REFERRAL_MANAGER_ROLE();
      expect(await playFiLicenseSale.hasRole(adminRole, admin.address)).to.be.equal(true);
      expect(await playFiLicenseSale.hasRole(adminRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseSale.hasRole(guardianRole, guardian.address)).to.be.equal(true);
      expect(await playFiLicenseSale.hasRole(guardianRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseSale.hasRole(merkleManagerRole, merkleManager.address)).to.be.equal(true);
      expect(await playFiLicenseSale.hasRole(merkleManagerRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseSale.hasRole(referralManagerRole, referralManager.address)).to.be.equal(true);
      expect(await playFiLicenseSale.hasRole(referralManagerRole, users[10].address)).to.be.equal(false);
    });

      it("Claiming a team license cannot be done when the team sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"TeamSaleNotActive");
      });

      it("Claiming team licenses cannot be done for more than the individual cap", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming team licenses cannot be done if the index is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses cannot be done if the claimCap is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses cannot be done with another address", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses claims new team licenses, even in 2 times and sets the correct on-chain state", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
          await impersonate(users[10], provider);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.emit(contracts.PlayFiLicenseSale,"TeamLicensesClaimed").withArgs(users[10].address,1);
          //claim 2 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data2,proof)).to.emit(contracts.PlayFiLicenseSale,"TeamLicensesClaimed").withArgs(users[10].address,1);
          //claim 3 -- should fail
          const data3 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data3,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "IndividualClaimCapExceeded");
          expect(await contracts.PlayFiLicenseSale.teamClaimsPerAddress(users[10].address)).to.be.equal(2);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("Claiming a friends & family license cannot be done when the friends & family sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"FriendsFamilySaleNotActive");
      });

      it("Claiming friends & family licenses cannot be done for more than the individual cap", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming friends & family licenses cannot be done if the index is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done if the claimCap is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done with another address", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done if the payment is insufficient", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should revert
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(2,data,proof,{value: ethers.parseEther("0.005")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InsufficientPayment");
          expect(await contracts.PlayFiLicenseSale.friendsFamilyClaimsPerAddress(users[10].address)).to.be.equal(0);
      });

      it("Claiming friends & family licenses claims new friends & family licenses, even in 2 times and sets the correct on-chain state", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
          await impersonate(users[10], provider);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof,{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"FriendsFamilyLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.01"),1);
          //claim 2 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data2,proof,{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"FriendsFamilyLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.01"),1);
          //claim 3 -- should fail
          const data3 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data3,proof,{value: ethers.parseEther("0.01")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "IndividualClaimCapExceeded");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.02"));
          expect(await contracts.PlayFiLicenseSale.friendsFamilyClaimsPerAddress(users[10].address)).to.be.equal(2);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("Claiming a early access license cannot be done when the early access sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"EarlyAccessSaleNotActive");
      });

      it("Claiming early access licenses cannot be done for more than the individual cap", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

       it("Claiming early access licenses cannot be done if the index is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done if the claimCap is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done with another address", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done if the payment is insufficient", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should revert
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(2,data,proof,{value: ethers.parseEther("0.015")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InsufficientPayment");
          expect(await contracts.PlayFiLicenseSale.earlyAccessClaimsPerAddress(users[10].address)).to.be.equal(0);
      });

      it("Claiming early access licenses claims new early access licenses, even in 2 times and sets the correct on-chain state", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
          await impersonate(users[10], provider);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof,{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"EarlyAccessLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.01"),1);
          //claim 2 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data2,proof,{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"EarlyAccessLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.01"),1);
          //claim 3 -- should fail
          const data3 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data3,proof,{value: ethers.parseEther("0.01")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "IndividualClaimCapExceeded");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.02"));
          expect(await contracts.PlayFiLicenseSale.earlyAccessClaimsPerAddress(users[10].address)).to.be.equal(2);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("Claiming a partner license cannot be done when the partner sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PartnerSaleNotActive");
      });

      it("Claiming partner licenses cannot be done for more than the individual cap", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming partner licenses cannot be done if the index is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming partner licenses cannot be done if the claimCap is incorrect", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming partner licenses cannot be done with another address", async function () {
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicensePartner(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming partner licenses cannot be done if the payment is insufficient", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,8],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should revert
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,data,proof,{value: ethers.parseEther("0.035")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InsufficientPayment");
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress(users[10].address)).to.be.equal(0);
      });

      it("Claiming partner licenses claims new partner licenses, even in 2 times and sets the correct on-chain state", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,8],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
          await impersonate(users[10], provider);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,data,proof,{value: ethers.parseEther("0.02")})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.02"),1);
          //claim 2 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,data2,proof,{value: ethers.parseEther("0.02")})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,ethers.parseEther("0.02"),1);
          //claim 3 -- should fail
          const data3 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,data3,proof,{value: ethers.parseEther("0.02")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "IndividualClaimCapExceeded");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.04"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress(users[10].address)).to.be.equal(2);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("Claiming a public license cannot be done when the public sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PublicSaleNotActive");
      });

      it("Claiming a public license cannot be done when the total tier cap is exceeded", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"TotalTierCapExceeded");
      });

      it("Claiming a public license cannot be done when the individual tier cap is exceeded", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[2]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualTierCapExceeded");
      });

      it("Claiming public licenses cannot be done if the payment is insufficient", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[2]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"",{value: toPay - ethers.parseEther("0.0000001")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InsufficientPayment");
      });

      it("If a valid referral is applied, the correct commission will be paid to the qualified receiver", async function () {
          const startAmount = ethers.parseEther("1000000000000");
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await impersonate(referralManager, provider);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,10,5);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
          await impersonate(users[10], provider);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          await impersonate(users[12], provider);
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase())).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePublic(2,1,users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.035"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.001"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[12].address)).to.be.equal(2);
      });

      it("Claiming a public license will activate a personal referral key", async function () {
          const startAmount = ethers.parseEther("1000000000000");
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await impersonate(referralManager, provider);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,10,5);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          const referralBefore = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralBefore[0]).to.be.equal(0);
          expect(referralBefore[1]).to.be.equal(0);
          expect(referralBefore[2]).to.be.equal(ethers.ZeroAddress);

          // Node license sale
          await impersonate(users[10], provider);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);

          const referralAfter = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralAfter[0]).to.be.equal(5);
          expect(referralAfter[1]).to.be.equal(5);
          expect(referralAfter[2]).to.be.equal(users[10].address);
      });

      it("Claiming public licenses claims new public licenses and sets the correct on-chain state", async function () {
          const startAmount = ethers.parseEther("1000000000000");
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await impersonate(referralManager, provider);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,10,5);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
          await impersonate(users[10], provider);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          await impersonate(users[12], provider);
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase())).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePublic(2,1,users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.035"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.001"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[12].address)).to.be.equal(2);
          tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(4);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(4);
      });

      it("PaymentDetailsForReferral returns the correct amount to pay, commission and discount in case of a valid referral is used", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await impersonate(referralManager, provider);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,10,5);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code): 10% commission, 5% discount
          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL");
          await impersonate(users[10], provider);
          await users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: paymentDetailsSpecial.toPay});
          expect(paymentDetailsSpecial[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsSpecial[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsSpecial[2]).to.be.equal(ethers.parseEther("0.001"));

          // Normal Referral (with address in lowercase): 5% commission, 5% discount
          const paymentDetailsNormal = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase());
          expect(paymentDetailsNormal[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsNormal[1]).to.be.equal(ethers.parseEther("0.001"));
          expect(paymentDetailsNormal[2]).to.be.equal(ethers.parseEther("0.001"));
      });

      it("getTier returns the tier details", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          const tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          const tier2 = await contracts.PlayFiLicenseSale.tiers(2);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(0);
          expect(tier1[3]).to.be.equal(2);
          expect(tier2[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier2[1]).to.be.equal(2);
          expect(tier2[2]).to.be.equal(0);
          expect(tier2[3]).to.be.equal(4);
      });

      it("getReferral returns the referral details", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          const tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          const tier2 = await contracts.PlayFiLicenseSale.tiers(2);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(0);
          expect(tier1[3]).to.be.equal(2);
          expect(tier2[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier2[1]).to.be.equal(2);
          expect(tier2[2]).to.be.equal(0);
          expect(tier2[3]).to.be.equal(4);
      });

      it("setReferral can only be done by the referral manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,10,5)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied")
      });

      it("setReferral can only be done for an invalid discount", async function () {
          await expect(referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,10,51)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidDiscount")
      });

      it("setReferral can only be done for an invalid commission", async function () {
          await expect(referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,51,5)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidCommission")
      });

      it("setReferral sets the code of the referral, the discount and the commission. Both for new and existing referrals", async function () {
          await impersonate(referralManager, provider);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,10,5);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(5);
          expect(referral[1]).to.be.equal(10);
          expect(referral[2]).to.be.equal(users[10].address);

          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,15,10);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(10);
          expect(referral[1]).to.be.equal(15);
          expect(referral[2]).to.be.equal(users[11].address);
      });

      it("setTiers can only be done by the admin", async function () {
          await expect(users[10].PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTiers can only be done by the admin", async function () {
          await expect(admin.PlayFiLicenseSale.setTiers([1,2,3],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02"),ethers.parseEther("0.03")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2,3],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4,5])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
      });

      it("setTiers sets the price, individual cap and total cap of the tier. It leaves the total amount of claims for the tiers a is.", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await impersonate(users[10], provider);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"",{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"");
          let tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(2);

          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.02"),ethers.parseEther("0.02")],[2,2],[4,4]);

          tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(4);
      });

      it("setTeamMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTeamMerkleRoot sets the merkle root of the team license claim", async function () {
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.teamMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setFriendsFamilyMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setFriendsFamilyMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setFriendsFamilyMerkleRoot sets the merkle root of the friends & family license claim", async function () {
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.friendsFamilyMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setEarlyAccessMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setEarlyAccessMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setEarlyAccessMerkleRoot sets the merkle root of the early access license claim", async function () {
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.earlyAccessMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setPartnerMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setPartnerMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPartnerMerkleRoot sets the merkle root of the partner license claim", async function () {
          await impersonate(merkleManager, provider);
          await merkleManager.PlayFiLicenseSale.setPartnerMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.partnerMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setTeamSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTeamSale sets the status of the team sale", async function () {
          expect(await contracts.PlayFiLicenseSale.teamSaleActive()).to.be.equal(false);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          expect(await contracts.PlayFiLicenseSale.teamSaleActive()).to.be.equal(true);
      });

      it("setFriendsFamilySale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setFriendsFamilySale sets the status of the friends & family sale", async function () {
          expect(await contracts.PlayFiLicenseSale.friendsFamilySaleActive()).to.be.equal(false);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          expect(await contracts.PlayFiLicenseSale.friendsFamilySaleActive()).to.be.equal(true);
      });

      it("setEarlyAccessSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setEarlyAccessSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setEarlyAccessSale sets the status of the early access sale", async function () {
          expect(await contracts.PlayFiLicenseSale.earlyAccessSaleActive()).to.be.equal(false);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          expect(await contracts.PlayFiLicenseSale.earlyAccessSaleActive()).to.be.equal(true);
      });

      it("setPartnerSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setPartnerSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPartnerSale sets the status of the partner sale", async function () {
          expect(await contracts.PlayFiLicenseSale.partnerSaleActive()).to.be.equal(false);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPartnerSale(true);
          expect(await contracts.PlayFiLicenseSale.partnerSaleActive()).to.be.equal(true);
      });

      it("setPublicSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setPublicSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPublicSale sets the status of the public sale", async function () {
          expect(await contracts.PlayFiLicenseSale.publicSaleActive()).to.be.equal(false);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          expect(await contracts.PlayFiLicenseSale.publicSaleActive()).to.be.equal(true);
      });

      it("withdrawing proceeds can only be done by the admin", async function () {
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
          await expect(users[10].PlayFiLicenseSale.withdrawProceeds()).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
      });

      it("withdrawing proceeds transfers all proceeds to the method caller.", async function () {
          await impersonate(admin, provider);
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await impersonate(guardian, provider);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const balanceBefore = await ethers.provider.getBalance(admin.address);
          await impersonate(users[10], provider);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"",{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.01"));
          await impersonate(admin, provider);
          await (await admin.PlayFiLicenseSale.withdrawProceeds()).wait();
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
          expect(await ethers.provider.getBalance(admin.address)).to.be.equal(balanceBefore + ethers.parseEther("0.01"));
      });
  });

});
