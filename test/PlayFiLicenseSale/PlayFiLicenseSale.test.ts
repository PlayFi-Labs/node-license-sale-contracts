import {parseEther, Wallet} from "ethers";
import hre, { ethers, upgrades } from "hardhat";
import { Contracts, setupIntegration } from "../_helpers/evm/index";
import { expect } from "chai";
import { User } from "../_helpers/evm";
import {PlayFiLicenseSale} from "../../typechain";
import ClaimsTree from "../../scripts/merkle-tree/claims-tree";
import PublicClaimsTree from "../../scripts/merkle-tree/claims-tree-public";
import {parseAllocationsMap} from "../../scripts/merkle-tree/parse-balance-map-public";

const ONE_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000001'


describe("PlayFiLicenseSale", () => {
  let contracts: Contracts;
  let deployer: User;
  let deployerMultisig: User;
  let admin: User;
  let guardian: User;
  let merkleManager: User;
  let referralManager: User;
  let users: User[];

  beforeEach(async () => {
    //await ethers.provider.send("hardhat_reset", []);
    ({ contracts, deployer, deployerMultisig, admin, guardian, merkleManager, referralManager, users } =
      await setupIntegration());
  });

  describe("Contract Functionality", async function () {
    it("admin address cannot be 0 on initializing", async function () {
      await expect(
        upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseSale"), [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
        ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("guardian address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseSale"), [
            admin.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("merkleManager address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseSale"), [
            admin.address,
            guardian.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("referralManager address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseSale"), [
            admin.address,
            guardian.address,
            merkleManager.address,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("initializing the contract sets the correct on-chain states", async function () {
      const playFiLicenseSale = await upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseSale"), [
        admin.address,
        guardian.address, merkleManager.address, referralManager.address
      ]) as unknown as PlayFiLicenseSale;
      await playFiLicenseSale.waitForDeployment();
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
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming team licenses cannot be done if the index is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses cannot be done if the claimCap is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses cannot be done with another address", async function () {
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseTeam(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming team licenses claims new team licenses, even in 2 times and sets the correct on-chain state", async function () {
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
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
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming friends & family licenses cannot be done if the index is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done if the claimCap is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done with another address", async function () {
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseFriendsFamily(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming friends & family licenses cannot be done if the payment is insufficient", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should revert
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseFriendsFamily(2,data,proof,{value: ethers.parseEther("0.005")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InsufficientPayment");
          expect(await contracts.PlayFiLicenseSale.friendsFamilyClaimsPerAddress(users[10].address)).to.be.equal(0);
      });

      it("Claiming friends & family licenses claims new friends & family licenses, even in 2 times and sets the correct on-chain state", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
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
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,0]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(2,data,[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

       it("Claiming early access licenses cannot be done if the index is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[1,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done if the claimCap is incorrect", async function () {
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,1]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done with another address", async function () {
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[11].PlayFiLicenseSale.claimLicenseEarlyAccess(1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("Claiming early access licenses cannot be done if the payment is insufficient", async function () {
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should revert
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseSale.claimLicenseEarlyAccess(2,data,proof,{value: ethers.parseEther("0.015")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InsufficientPayment");
          expect(await contracts.PlayFiLicenseSale.earlyAccessClaimsPerAddress(users[10].address)).to.be.equal(0);
      });

      it("Claiming early access licenses claims new early access licenses, even in 2 times and sets the correct on-chain state", async function () {
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,1],[1,1]);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          //claim 1 -- should succeed
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
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,1,"POLYGON","REFERRAL")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PartnerSaleNotActive");
      });

      it("Claiming partner licenses cannot be done when the total tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"TotalTierCapExceeded");
      });

      it("Claiming partner licenses cannot be done when the individual tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1],[2]);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualTierCapExceeded");
      });

      it("Claiming partner licenses cannot be done if the payment is insufficient", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[2]);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","",{value: toPay - ethers.parseEther("0.0000001")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InsufficientPayment");
      });

      it("If a valid referral is applied, the correct commission will be paid to the qualified receiver (Large partner sale)", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(2);
      });

      it("If a valid referral is applied, the correct commission will be paid to the qualified receiver (Small partner sale)", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["MULTIVERSE"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await admin.PlayFiLicenseSale.setPartnerReceiverAddress("MULTIVERSE",users[11].address);
          await guardian.PlayFiLicenseSale.setPartnerSale("MULTIVERSE", true);

          // Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"MULTIVERSE","")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"MULTIVERSE","",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"MULTIVERSE","");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("MULTIVERSE",users[10].address)).to.be.equal(2);
      });

      it("Claiming partner licenses claims new partner licenses and sets the correct on-chain state", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(2);
          expect(referral[1]).to.be.equal(users[11].address);
      });

      it("Claiming partner licenses uses the correct commission after multiple referral usages", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1000],[4000]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);
          const startAmount =  await ethers.provider.getBalance(users[11].address);

          // first 20 claims
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,20,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.16"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.02"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(20);
          let tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(20);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(20);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(20);
          expect(referral[1]).to.be.equal(users[11].address);

          // 40 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,20,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.316"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.042"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(40);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(40);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(40);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(40);
          expect(referral[1]).to.be.equal(users[11].address);

          // 60 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,20,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.468"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.066"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(60);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(60);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(60);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(60);
          expect(referral[1]).to.be.equal(users[11].address);

          // 80 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,20,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.616"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.092"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(80);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(80);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(80);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(80);
          expect(referral[1]).to.be.equal(users[11].address);

          // 100 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,20,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.76"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.12"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(100);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(100);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(100);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(100);
          expect(referral[1]).to.be.equal(users[11].address);

          // 100+ claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,1,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.767"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.1215"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(101);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(101);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(101);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(101);
          expect(referral[1]).to.be.equal(users[11].address);
      });

      it("Claiming a public license cannot be done when the public sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PublicSaleNotActive");
      });

      it("Claiming a public license cannot be done when the total tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"TotalTierCapExceeded");
      });

      it("Claiming a public license cannot be done when the individual tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1],[2]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualTierCapExceeded");
      });

      it("Claiming public licenses cannot be done if the payment is insufficient", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[2]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"", false)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"",{value: toPay - ethers.parseEther("0.0000001")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InsufficientPayment");
      });

      it("If a valid referral is applied, the correct commission will be paid to the qualified receiver", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", false)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);
      });

      it("Claiming public licenses claims new public licenses and sets the correct on-chain state", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", false)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("Claiming a public whitelist license cannot be done when the public whitelist sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(1,1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PublicWhitelistSaleNotActive");
      });

      it("Claiming a public whitelist license cannot be done when the total whitelist tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: ""},
              {account: users[9].address, claimCap: BigInt("2"), referral: ""}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"), "");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, ""]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"TotalTierCapExceeded");
      });

      it("Claiming a public whitelist license cannot be done when the individual claim cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[1000],[2]);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("1"), referral: ""},
              {account: users[9].address, claimCap: BigInt("1"), referral: ""}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("1"), "");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,1, ""]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"IndividualClaimCapExceeded");
      });

      it("Claiming public whitelist licenses cannot be done if the payment is insufficient", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[2]);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: "REFERRAL"},
              {account: users[9].address, claimCap: BigInt("2"), referral: ""}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, "REFERRAL"]);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", true)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1, data, proof,{value: toPay - ethers.parseEther("0.0000001")})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InsufficientPayment");
      });

      it("Claiming public whitelist licenses cannot be done if the proof is incorrect", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[2]);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: "REFERRAL"},
              {account: users[9].address, claimCap: BigInt("2"), referral: ""}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(1, users[9].address, BigInt("2"), "");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, "REFERRAL"]);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", true)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1, data, proof,{value: toPay})).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidProof");
      });

      it("If a valid referral is applied, the correct comission will be paid to the qualified receiver", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: "REFERRAL"},
              {account: users[12].address, claimCap: BigInt("2"), referral: users[10].address.toLowerCase()}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, "REFERRAL"]);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", true)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof,{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicWhitelistLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[10].address,"REFERRAL")).to.be.equal(2);
      });

      it("Claiming public whitelist licenses claims new public whitelist licenses and sets the correct on-chain state", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);
          const startAmount = await ethers.provider.getBalance(users[11].address);

          // Referral (with code)
          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: "REFERRAL"},
              {account: users[12].address, claimCap: BigInt("2"), referral: users[10].address.toLowerCase()}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, "REFERRAL"]);
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", true)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof,{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicWhitelistLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.016"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[10].address,"REFERRAL")).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
      });

      it("PaymentDetailsForReferral returns the correct amount to pay, commission and discount in case of a valid referral is used", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1000],[4000]);
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.02")],[1000],[4000]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);

          // Referral (with code): 10% commission, 10% discount
          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",false);
          await users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: paymentDetailsSpecial.toPay});
          expect(paymentDetailsSpecial[0]).to.be.equal(ethers.parseEther("0.018"));
          expect(paymentDetailsSpecial[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsSpecial[2]).to.be.equal(ethers.parseEther("0.002"));

          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("1000"), referral: "REFERRAL"},
              {account: users[12].address, claimCap: BigInt("1000"), referral: users[10].address.toLowerCase()}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("1000"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,1000, "REFERRAL"]);

          //Whitelist
          // Referral (with code): 10% commission, 10% discount
          const paymentDetailsSpecialWhitelist = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",true);
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof,{value: paymentDetailsSpecialWhitelist.toPay});
          expect(paymentDetailsSpecialWhitelist[0]).to.be.equal(ethers.parseEther("0.036"));
          expect(paymentDetailsSpecialWhitelist[1]).to.be.equal(ethers.parseEther("0.004"));
          expect(paymentDetailsSpecialWhitelist[2]).to.be.equal(ethers.parseEther("0.004"));

          // Test dynamic pricing

          // After first 20
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(19,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(19,1,"REFERRAL",{value: toPay});
          let paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0089"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0011"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0011"));

          // After first 40
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(20,1,"REFERRAL",true)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(20,1,data,proof,{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",true);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0176"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0024"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0024"));

          // After first 60
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(20,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(20,1,"REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0087"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0013"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0013"));

          // After first 80
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(20,1,"REFERRAL",true)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(20,1,data,proof,{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",true);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0172"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0028"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0028"));

          // After first 100
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(20,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(20,1,"REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0085"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0015"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0015"));
      });

      it("paymentDetailsForPartnerReferral returns the correct amount to pay, commission and discount in case of a valid referral is used", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1000],[4000]);
          await users[11].PlayFiLicenseSale.setReferral("REFERRAL");
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);

          // Referral (with code): 10% commission, 10% discount
          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL");
          await users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: paymentDetailsSpecial.toPay});
          expect(paymentDetailsSpecial[0]).to.be.equal(ethers.parseEther("0.018"));
          expect(paymentDetailsSpecial[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsSpecial[2]).to.be.equal(ethers.parseEther("0.002"));

          // Test dynamic pricing

          // After first 20
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(19,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(19,1,"POLYGON","REFERRAL",{value: toPay});
          let paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0089"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0011"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0011"));

          // After first 40
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0088"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0012"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0012"));

          // After first 60
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0087"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0013"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0013"));

          // After first 80
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0086"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0014"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0014"));

          // After first 100
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(20,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(20,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0085"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0015"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0015"));
      });

      it("getTier returns the tier details", async function () {
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          const tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          const tier2 = await contracts.PlayFiLicenseSale.tiers(2);
          const whitelistTier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          const whitelistTier2 = await contracts.PlayFiLicenseSale.whitelistTiers(2);
          const partnerTier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          const partnerTier2 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",2);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(0);
          expect(tier1[3]).to.be.equal(2);
          expect(tier2[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier2[1]).to.be.equal(2);
          expect(tier2[2]).to.be.equal(0);
          expect(tier2[3]).to.be.equal(4);
          expect(whitelistTier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(whitelistTier1[1]).to.be.equal(1);
          expect(whitelistTier1[2]).to.be.equal(0);
          expect(whitelistTier1[3]).to.be.equal(2);
          expect(whitelistTier2[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(whitelistTier2[1]).to.be.equal(2);
          expect(whitelistTier2[2]).to.be.equal(0);
          expect(whitelistTier2[3]).to.be.equal(4);
          expect(partnerTier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(partnerTier1[1]).to.be.equal(1);
          expect(partnerTier1[2]).to.be.equal(0);
          expect(partnerTier1[3]).to.be.equal(2);
          expect(partnerTier2[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(partnerTier2[1]).to.be.equal(2);
          expect(partnerTier2[2]).to.be.equal(0);
          expect(partnerTier2[3]).to.be.equal(4);
      });

      it("getReferral returns the referral details", async function () {
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

      it("setReferralForReceiver can only be done by the referral manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setReferralForReceiver("REFERRAL",users[10].address)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied")
      });

      it("setReferralForReceiver cannot be done for an already used referral code", async function () {
          await referralManager.PlayFiLicenseSale.setReferralForReceiver("REFERRAL",users[10].address);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(0);
          expect(referral[1]).to.be.equal(users[10].address);

          await expect(referralManager.PlayFiLicenseSale.setReferralForReceiver("REFERRAL",users[11].address)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"ReferralCodeInUse");
      });

      it("setReferralForReceiver cannot be done with an empty code", async function () {
          await expect(referralManager.PlayFiLicenseSale.setReferralForReceiver("",users[11].address)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidCode");
      });

      it("setReferralForReceiver sets the code of the referral and the state. Both for new and existing referrals", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1000],[4000]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);


          await referralManager.PlayFiLicenseSale.setReferralForReceiver("REFERRAL",users[10].address);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(0);
          expect(referral[1]).to.be.equal(users[10].address);

          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",false);
          await users[11].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: paymentDetailsSpecial.toPay});

          await referralManager.PlayFiLicenseSale.setReferralForReceiver("REFERRAL2",users[10].address);
          let referralOld = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referralOld[0]).to.be.equal(0);
          expect(referralOld[1]).to.be.equal(ethers.ZeroAddress);

          let referralNew = await contracts.PlayFiLicenseSale.referrals("REFERRAL2");
          expect(referralNew[0]).to.be.equal(2);
          expect(referralNew[1]).to.be.equal(users[10].address);
      });


      it("setReferral cannot be done for an already used referral code", async function () {
          await referralManager.PlayFiLicenseSale.setReferralForReceiver("REFERRAL",users[10].address);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(0);
          expect(referral[1]).to.be.equal(users[10].address);

          await expect(users[11].PlayFiLicenseSale.setReferral("REFERRAL")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"ReferralCodeInUse");
      });

      it("setReferral cannot be done with an empty code", async function () {
          await expect(users[11].PlayFiLicenseSale.setReferral("")).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidCode");
      });

      it("setReferral sets the code of the referral and the state. Both for new and existing referrals", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1000],[4000]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);


          await users[10].PlayFiLicenseSale.setReferral("REFERRAL");
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(0);
          expect(referral[1]).to.be.equal(users[10].address);

          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",false);
          await users[11].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: paymentDetailsSpecial.toPay});

          await users[10].PlayFiLicenseSale.setReferral("REFERRAL2");
          let referralOld = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referralOld[0]).to.be.equal(0);
          expect(referralOld[1]).to.be.equal(ethers.ZeroAddress);

          let referralNew = await contracts.PlayFiLicenseSale.referrals("REFERRAL2");
          expect(referralNew[0]).to.be.equal(2);
          expect(referralNew[1]).to.be.equal(users[10].address);
      });

      it("setTiers can only be done by the admin", async function () {
          await expect(users[10].PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTiers cannot be done for incorrect parameter lengths", async function () {
          await expect(admin.PlayFiLicenseSale.setTiers([1,2,3],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02"),ethers.parseEther("0.03")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2,3],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4,5])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
      });

      it("setTiers sets the price, individual cap and total cap of the tier. It leaves the total amount of claims for the tiers a is.", async function () {
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"",{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"");
          let tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(2);

          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.02"),ethers.parseEther("0.02")],[2,2],[4,4]);

          tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(4);
      });

      it("setWhitelistTiers can only be done by the admin", async function () {
          await expect(users[10].PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setWhitelistTiers cannot be done for incorrect parameter lengths", async function () {
          await expect(admin.PlayFiLicenseSale.setWhitelistTiers([1,2,3],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02"),ethers.parseEther("0.03")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2,3],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4,5])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
      });

      it("setWhitelistTiers sets the price, individual cap and total cap of the tier. It leaves the total amount of claims for the tiers a is.", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await guardian.PlayFiLicenseSale.setPublicWhitelistSale(true);

          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("2"), referral: "REFERRAL"},
              {account: users[12].address, claimCap: BigInt("2"), referral: users[10].address.toLowerCase()}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,2, "REFERRAL"]);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(1,1, data,proof,{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PublicWhitelistLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"REFERRAL");
          let tier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(2);

          await admin.PlayFiLicenseSale.setWhitelistTiers([1,2],[ethers.parseEther("0.02"),ethers.parseEther("0.02")],[2,2],[4,4]);

          tier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(4);
      });

      it("setPartnerTiers can only be done by the admin", async function () {
          await expect(users[10].PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPartnerTiers cannot be done for incorrect parameter lengths", async function () {
          await expect(admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2,3],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02"),ethers.parseEther("0.03")],[1,2],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2,3],[2,4])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
          await expect(admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4,5])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"InvalidTierInputs");
      });

      it("setPartnerTiers sets the price, individual cap and total cap of the tier. It leaves the total amount of claims for the tiers a is.", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,1, "POLYGON","",{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"POLYGON","");
          let tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(2);

          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON","POLYGON"],[1,2],[ethers.parseEther("0.02"),ethers.parseEther("0.02")],[2,2],[4,4]);

          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.02"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(1);
          expect(tier1[3]).to.be.equal(4);
      });

      it("setTeamMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTeamMerkleRoot sets the merkle root of the team license claim", async function () {
          await merkleManager.PlayFiLicenseSale.setTeamMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.teamMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setFriendsFamilyMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setFriendsFamilyMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setFriendsFamilyMerkleRoot sets the merkle root of the friends & family license claim", async function () {
          await merkleManager.PlayFiLicenseSale.setFriendsFamilyMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.friendsFamilyMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setEarlyAccessMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setEarlyAccessMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setEarlyAccessMerkleRoot sets the merkle root of the early access license claim", async function () {
          await merkleManager.PlayFiLicenseSale.setEarlyAccessMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.earlyAccessMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setPublicMerkleRoot can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setPublicMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPublicMerkleRoot sets the merkle root of the public whitelist license claim", async function () {
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseSale.publicMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("setTeamSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setTeamSale sets the status of the team sale", async function () {
          expect(await contracts.PlayFiLicenseSale.teamSaleActive()).to.be.equal(false);
          await guardian.PlayFiLicenseSale.setTeamSale(true);
          expect(await contracts.PlayFiLicenseSale.teamSaleActive()).to.be.equal(true);
      });

      it("setFriendsFamilySale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setTeamSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setFriendsFamilySale sets the status of the friends & family sale", async function () {
          expect(await contracts.PlayFiLicenseSale.friendsFamilySaleActive()).to.be.equal(false);
          await guardian.PlayFiLicenseSale.setFriendsFamilySale(true);
          expect(await contracts.PlayFiLicenseSale.friendsFamilySaleActive()).to.be.equal(true);
      });

      it("setEarlyAccessSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setEarlyAccessSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setEarlyAccessSale sets the status of the early access sale", async function () {
          expect(await contracts.PlayFiLicenseSale.earlyAccessSaleActive()).to.be.equal(false);
          await guardian.PlayFiLicenseSale.setEarlyAccessSale(true);
          expect(await contracts.PlayFiLicenseSale.earlyAccessSaleActive()).to.be.equal(true);
      });

      it("setPartnerSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setPartnerSale("POLYGON", true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPartnerSale sets the status of the partner sale", async function () {
          expect(await contracts.PlayFiLicenseSale.partnerSaleActive("POLYGON")).to.be.equal(false);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);
          expect(await contracts.PlayFiLicenseSale.partnerSaleActive("POLYGON")).to.be.equal(true);
      });

      it("setPublicSale can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseSale.setPublicSale(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPublicSale sets the status of the public sale", async function () {
          expect(await contracts.PlayFiLicenseSale.publicSaleActive()).to.be.equal(false);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          expect(await contracts.PlayFiLicenseSale.publicSaleActive()).to.be.equal(true);
      });

      it("withdrawing proceeds can only be done by the admin", async function () {
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
          await expect(users[10].PlayFiLicenseSale.withdrawProceeds()).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
      });

      it("withdrawing proceeds transfers all proceeds to the method caller.", async function () {
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.01"),ethers.parseEther("0.02")],[1,2],[2,4]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
          const balanceBefore = await ethers.provider.getBalance(admin.address);
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(1,1,"",{value: ethers.parseEther("0.01")})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,1,1,ethers.parseEther("0.01"),"");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.01"));
          const receipt = await (await admin.PlayFiLicenseSale.withdrawProceeds()).wait();
          const feePaid = receipt!.gasUsed * receipt!.gasPrice;
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(0);
          expect(await ethers.provider.getBalance(admin.address)).to.be.equal(balanceBefore - feePaid + ethers.parseEther("0.01"));
      });

      it("setPartnerReceiverAddress can only be done by the admin", async function () {
          await expect(users[10].PlayFiLicenseSale.setPartnerReceiverAddress("METAVERSE",users[10].address)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied");
      });

      it("setPartnerReceiverAddress sets the receiver address of the partner", async function () {
          expect((await contracts.PlayFiLicenseSale.partnerReferrals("METAVERSE"))[1]).to.be.equal(ethers.ZeroAddress);
          await admin.PlayFiLicenseSale.setPartnerReceiverAddress("METAVERSE", users[10].address);
          expect((await contracts.PlayFiLicenseSale.partnerReferrals("METAVERSE"))[1]).to.be.equal(users[10].address);
      });
  });

});
