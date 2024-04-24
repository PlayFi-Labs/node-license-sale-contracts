import { Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import { Contracts, setupIntegration } from "./../_helpers/game/index";
import { expect } from "chai";
import { User } from "../_helpers/game";
import {PlayFiLicenseSale} from "../../typechain";
import ClaimsTree from "../../scripts/merkle-tree/claims-tree";

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
      });
  });

});
