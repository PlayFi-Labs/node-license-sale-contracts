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
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);

          // Special Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON",users[10].address.toLowerCase())).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON",users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[12].address,2,1,toPay2,"POLYGON",users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[12].address)).to.be.equal(2);
      });

      it("If a valid referral is applied, the correct commission will be paid to the qualified receiver (Small partner sale)", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["MULTIVERSE"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("MULTIVERSE",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("MULTIVERSE", true);

          // Special Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"MULTIVERSE","")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"MULTIVERSE","",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"MULTIVERSE","");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.018"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("MULTIVERSE",users[10].address)).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"MULTIVERSE",users[10].address.toLowerCase())).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePartner(2,1,"MULTIVERSE",users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[12].address,2,1,toPay2,"MULTIVERSE",users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.036"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.004"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("MULTIVERSE",users[12].address)).to.be.equal(2);
      });

      it("Claiming a partner license will activate a personal referral key only if the partner sale has no referral set", async function () {
          // PartnerSale has own referral set
          let startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["METAVERSE"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("METAVERSE",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("METAVERSE",true);

          let referralBefore = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralBefore[0]).to.be.equal(false);
          expect(referralBefore[1]).to.be.equal(0);
          expect(referralBefore[2]).to.be.equal(ethers.ZeroAddress);

          // Node license sale
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"METAVERSE","METAVERSE")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"METAVERSE","METAVERSE",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"METAVERSE","METAVERSE");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.018"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("METAVERSE",users[10].address)).to.be.equal(2);

          let referralAfter = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralAfter[0]).to.be.equal(false);
          expect(referralAfter[1]).to.be.equal(0);
          expect(referralAfter[2]).to.be.equal(ethers.ZeroAddress);

          // PartnerSale has no referral set

          startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);

          referralBefore = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralBefore[0]).to.be.equal(false);
          expect(referralBefore[1]).to.be.equal(0);
          expect(referralBefore[2]).to.be.equal(ethers.ZeroAddress);

          // Node license sale
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"POLYGON","");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.038"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(2);

          referralAfter = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralAfter[0]).to.be.equal(true);
          expect(referralAfter[1]).to.be.equal(0);
          expect(referralAfter[2]).to.be.equal(users[10].address);
      });

      it("Claiming partner licenses claims new partner licenses and sets the correct on-chain state", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);

          // Special Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,2,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(2);
          expect(referral[2]).to.be.equal(users[11].address);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON",users[10].address.toLowerCase())).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON",users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[12].address,2,1,toPay2,"POLYGON",users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[12].address)).to.be.equal(2);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(4);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(4);
          referral = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(2);
          expect(referral[2]).to.be.equal(users[10].address);
      });

      it("Claiming partner licenses uses the correct commission after multiple referral usages", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1000],[4000]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON",true);

          // first 25 claims
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,25,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.2125"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.025"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(25);
          let tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(25);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(25);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(25);
          expect(referral[2]).to.be.equal(users[11].address);

          // 50 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,25,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.41875"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.05625"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(50);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(50);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(50);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(50);
          expect(referral[2]).to.be.equal(users[11].address);

          // 75 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,25,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.61875"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.09375"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(75);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(75);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(75);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(75);
          expect(referral[2]).to.be.equal(users[11].address);

          // 100 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,25,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.8125"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.1375"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(100);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(100);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(100);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(100);
          expect(referral[2]).to.be.equal(users[11].address);

          // 150 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(50,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(50,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,50,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("1.1875"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.2375"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(150);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(150);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(150);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(150);
          expect(referral[2]).to.be.equal(users[11].address);

          // 200 claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(50,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(50,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,50,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("1.55"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.35"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(200);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(200);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(200);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(200);
          expect(referral[2]).to.be.equal(users[11].address);

          // 200+ claims
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL")).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePartner(1,1,"POLYGON","REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PartnerLicensesClaimed").withArgs(users[10].address,1,1,toPay,"POLYGON","REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("1.557"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.3525"));
          expect(await contracts.PlayFiLicenseSale.partnerClaimsPerAddress("POLYGON",users[10].address)).to.be.equal(201);
          tier1 = await contracts.PlayFiLicenseSale.partnerTiers("POLYGON",1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(201);
          expect(tier1[3]).to.be.equal(4000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(201);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(201);
          expect(referral[2]).to.be.equal(users[11].address);
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
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", false)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), false)).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePublic(2,1,users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[12].address)).to.be.equal(2);
      });

      it("Claiming a public license will activate a personal referral key", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          const referralBefore = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralBefore[0]).to.be.equal(false);
          expect(referralBefore[1]).to.be.equal(0);
          expect(referralBefore[2]).to.be.equal(ethers.ZeroAddress);

          // Node license sale
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", false)).toPay;
          await expect(users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: toPay})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[10].address,2,1,toPay,"REFERRAL");
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[10].address)).to.be.equal(2);

          const referralAfter = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralAfter[0]).to.be.equal(true);
          expect(referralAfter[1]).to.be.equal(0);
          expect(referralAfter[2]).to.be.equal(users[10].address);
      });

      it("Claiming public licenses claims new public licenses and sets the correct on-chain state", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
          const toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL", false)).toPay;
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
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), false)).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePublic(2,1,users[10].address.toLowerCase(),{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(users[12].address)).to.be.equal(2);
          tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(4);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(4);
      });

      it("Claiming a public whitelist license cannot be done when the public sale is not active", async function () {
          await expect(users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(1,1,"0x",[])).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"PublicSaleNotActive");
      });

      it("Claiming a public whitelist license cannot be done when the total whitelist tier cap is exceeded", async function () {
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[1],[1]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);
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
          await guardian.PlayFiLicenseSale.setPublicSale(true);
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
          await guardian.PlayFiLicenseSale.setPublicSale(true);
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
          await guardian.PlayFiLicenseSale.setPublicSale(true);
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
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
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
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[10].address,"REFERRAL")).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), true)).toPay;
          const proof2 = tree.getProof(1, users[12].address, BigInt("2"), users[10].address.toLowerCase());
          //claim 1 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[1,2, users[10].address.toLowerCase()]);
          await expect(users[12].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data2,proof2,{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicWhitelistLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[12].address, users[10].address.toLowerCase())).to.be.equal(2);
      });

      it("Claiming a public whitelist license will activate a personal referral key", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          const referralBefore = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralBefore[0]).to.be.equal(false);
          expect(referralBefore[1]).to.be.equal(0);
          expect(referralBefore[2]).to.be.equal(ethers.ZeroAddress);

          // Node license sale
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
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[10].address,"REFERRAL")).to.be.equal(2);

          const referralAfter = await contracts.PlayFiLicenseSale.referrals(users[10].address.toLowerCase());
          expect(referralAfter[0]).to.be.equal(true);
          expect(referralAfter[1]).to.be.equal(0);
          expect(referralAfter[2]).to.be.equal(users[10].address);
      });

      it("Claiming public whitelist licenses claims new public whitelist licenses and sets the correct on-chain state", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.01")],[2],[4]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code)
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
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.017"));
          expect(await ethers.provider.getBalance(users[11].address)).to.be.equal(startAmount + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[10].address,"REFERRAL")).to.be.equal(2);
          let tier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(2);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2);

          // Normal Referral (with address in lowercase)
          const startAmount2 = await ethers.provider.getBalance(users[10].address);
          const proof2 = tree.getProof(1, users[12].address, BigInt("2"), users[10].address.toLowerCase());
          //claim 1 -- should succeed
          const data2 = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[1,2, users[10].address.toLowerCase()]);
          const toPay2 = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), true)).toPay;
          await expect(users[12].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data2,proof2,{value: toPay2})).to.emit(contracts.PlayFiLicenseSale,"PublicWhitelistLicensesClaimed").withArgs(users[12].address,2,1,toPay2,users[10].address.toLowerCase());
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("0.034"));
          expect(await ethers.provider.getBalance(users[10].address)).to.be.equal(startAmount2 + ethers.parseEther("0.002"));
          expect(await contracts.PlayFiLicenseSale.publicWhitelistClaimsPerAddressAndReferral(users[12].address,users[10].address.toLowerCase())).to.be.equal(2);
          tier1 = await contracts.PlayFiLicenseSale.whitelistTiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.01"));
          expect(tier1[1]).to.be.equal(2);
          expect(tier1[2]).to.be.equal(4);
          expect(tier1[3]).to.be.equal(4);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(4);
      });

      it("PaymentDetailsForReferral returns the correct amount to pay, commission and discount in case of a valid referral is used", async function () {
          await admin.PlayFiLicenseSale.setTiers([1],[ethers.parseEther("0.01")],[1000],[4000]);
          await admin.PlayFiLicenseSale.setWhitelistTiers([1],[ethers.parseEther("0.02")],[1000],[4000]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          // Special Referral (with code): 10% commission, 5% discount
          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",false);
          await users[10].PlayFiLicenseSale.claimLicensePublic(2,1,"REFERRAL",{value: paymentDetailsSpecial.toPay});
          expect(paymentDetailsSpecial[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsSpecial[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsSpecial[2]).to.be.equal(ethers.parseEther("0.001"));

          // Normal Referral (with address in lowercase): 10% commission, 5% discount
          const paymentDetailsNormal = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), false);
          expect(paymentDetailsNormal[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsNormal[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsNormal[2]).to.be.equal(ethers.parseEther("0.001"));

          let tree = new PublicClaimsTree([
              {account: users[10].address, claimCap: BigInt("1000"), referral: "REFERRAL"},
              {account: users[12].address, claimCap: BigInt("1000"), referral: users[10].address.toLowerCase()}
          ]);
          await merkleManager.PlayFiLicenseSale.setPublicMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("1000"), "REFERRAL");
          //claim 1 -- should succeed
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256","string"],[0,1000, "REFERRAL"]);

          //Whitelist
          // Special Referral (with code): 10% commission, 5% discount
          const paymentDetailsSpecialWhitelist = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,"REFERRAL",true);
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(2,1,data,proof,{value: paymentDetailsSpecialWhitelist.toPay});
          expect(paymentDetailsSpecialWhitelist[0]).to.be.equal(ethers.parseEther("0.038"));
          expect(paymentDetailsSpecialWhitelist[1]).to.be.equal(ethers.parseEther("0.004"));
          expect(paymentDetailsSpecialWhitelist[2]).to.be.equal(ethers.parseEther("0.002"));

          // Normal Referral (with address in lowercase): 10% commission, 5% discount
          const paymentDetailsNormalWhitelist = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(2,1,users[10].address.toLowerCase(), true);
          expect(paymentDetailsNormalWhitelist[0]).to.be.equal(ethers.parseEther("0.038"));
          expect(paymentDetailsNormalWhitelist[1]).to.be.equal(ethers.parseEther("0.004"));
          expect(paymentDetailsNormalWhitelist[2]).to.be.equal(ethers.parseEther("0.002"));

          // Test dynamic pricing

          // After first 25
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(24,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(24,1,"REFERRAL",{value: toPay});
          let paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00125"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 50
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(25,1,"REFERRAL",true)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(25,1,data,proof,{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",true);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.003"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.001"));

          // After first 75
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(25,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(25,1,"REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00175"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 100
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(25,1,"REFERRAL",true)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(25,1,data,proof,{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",true);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.004"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.001"));

          // After first 150
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(50,1,"REFERRAL",false)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublic(50,1,"REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",false);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00225"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 200
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForReferral(50,1,"REFERRAL",true)).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePublicWhitelist(50,1,data,proof,{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForReferral(1,1,"REFERRAL",true);
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.005"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.001"));
      });

      it("paymentDetailsForPartnerReferral returns the correct amount to pay, commission and discount in case of a valid referral is used", async function () {
          await admin.PlayFiLicenseSale.setPartnerTiers(["POLYGON"],[1],[ethers.parseEther("0.01")],[1000],[4000]);
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,true);
          await guardian.PlayFiLicenseSale.setPartnerSale("POLYGON", true);

          // Special Referral (with code): 10% commission, 5% discount
          const paymentDetailsSpecial = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON","REFERRAL");
          await users[10].PlayFiLicenseSale.claimLicensePartner(2,1,"POLYGON","REFERRAL",{value: paymentDetailsSpecial.toPay});
          expect(paymentDetailsSpecial[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsSpecial[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsSpecial[2]).to.be.equal(ethers.parseEther("0.001"));

          // Normal Referral (with address in lowercase): 10% commission, 5% discount
          const paymentDetailsNormal = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(2,1,"POLYGON",users[10].address.toLowerCase());
          expect(paymentDetailsNormal[0]).to.be.equal(ethers.parseEther("0.019"));
          expect(paymentDetailsNormal[1]).to.be.equal(ethers.parseEther("0.002"));
          expect(paymentDetailsNormal[2]).to.be.equal(ethers.parseEther("0.001"));

          // Test dynamic pricing

          // After first 25
          let toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(24,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(24,1,"POLYGON","REFERRAL",{value: toPay});
          let paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00125"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 50
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0015"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 75
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00175"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 100
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(25,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(25,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0020"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 150
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(50,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(50,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.00225"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));

          // After first 200
          toPay = (await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(50,1,"POLYGON","REFERRAL")).toPay;
          await users[10].PlayFiLicenseSale.claimLicensePartner(50,1,"POLYGON","REFERRAL",{value: toPay});
          paymentDetails = await contracts.PlayFiLicenseSale.paymentDetailsForPartnerReferral(1,1,"POLYGON","REFERRAL");
          expect(paymentDetails[0]).to.be.equal(ethers.parseEther("0.0095"));
          expect(paymentDetails[1]).to.be.equal(ethers.parseEther("0.0025"));
          expect(paymentDetails[2]).to.be.equal(ethers.parseEther("0.0005"));
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

      it("setReferral can only be done by the referral manager", async function () {
          await expect(users[10].PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale,"AccessDenied")
      });

      it("setReferral sets the code of the referral and the state. Both for new and existing referrals", async function () {
          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[10].address,true);
          let referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(true);
          expect(referral[1]).to.be.equal(0);
          expect(referral[2]).to.be.equal(users[10].address);

          await referralManager.PlayFiLicenseSale.setReferral("REFERRAL",users[11].address,false);
          referral = await contracts.PlayFiLicenseSale.referrals("REFERRAL");
          expect(referral[0]).to.be.equal(false);
          expect(referral[1]).to.be.equal(0);
          expect(referral[2]).to.be.equal(users[11].address);
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
          await guardian.PlayFiLicenseSale.setPublicSale(true);

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
  });

});
