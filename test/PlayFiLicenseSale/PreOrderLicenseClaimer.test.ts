import {parseEther, Wallet} from "ethers";
import hre, { ethers, upgrades } from "hardhat";
import { Contracts, setupIntegration } from "../_helpers/evm/index";
import { expect } from "chai";
import { User } from "../_helpers/evm";
import {PlayFiLicenseSale, PreOrderLicenseClaimer} from "../../typechain";
import ClaimsTree from "../../scripts/merkle-tree/claims-tree";
import PublicClaimsTree from "../../scripts/merkle-tree/claims-tree-public";
import {parseAllocationsMap} from "../../scripts/merkle-tree/parse-balance-map-public";

const ONE_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000001'


describe("PreOrderLicenseClaimer", () => {
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
        upgrades.deployProxy(await ethers.getContractFactory("PreOrderLicenseClaimer"), [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
        ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("executor address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PreOrderLicenseClaimer"), [
            admin.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("licenseSale contract address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PreOrderLicenseClaimer"), [
            admin.address,
            deployer.address,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicenseSale, "InvalidAddress");
    });

    it("initializing the contract sets the correct on-chain states", async function () {
      const preOrderLicenseClaimer = await upgrades.deployProxy(await ethers.getContractFactory("PreOrderLicenseClaimer"), [
        admin.address,
        deployer.address, await contracts.PlayFiLicenseSale.getAddress()
      ]) as unknown as PreOrderLicenseClaimer;
      await preOrderLicenseClaimer.waitForDeployment()
      expect(await preOrderLicenseClaimer.licenseSale()).to.be.equal(await contracts.PlayFiLicenseSale.getAddress());
      const adminRole = await preOrderLicenseClaimer.ADMIN_ROLE();
      const executorRole = await preOrderLicenseClaimer.EXECUTOR_ROLE();
      expect(await preOrderLicenseClaimer.hasRole(adminRole, admin.address)).to.be.equal(true);
      expect(await preOrderLicenseClaimer.hasRole(executorRole, deployer.address)).to.be.equal(true);
        expect(await preOrderLicenseClaimer.hasRole(executorRole, admin.address)).to.be.equal(true);
    });

      it("claimPreOrders can only be done by the admin", async function () {
          await expect(users[10].PreOrderLicenseClaimer.claimPreOrders([1000,1000],[1,2])).to.be.revertedWithCustomError(contracts.PreOrderLicenseClaimer,"AccessDenied");
      });

      it("claimPreOrders cannot be done when the size of the amount and tier arrays are not of the same length", async function () {
          await expect(deployer.PreOrderLicenseClaimer.claimPreOrders([1000],[1,2])).to.be.revertedWithCustomError(contracts.PreOrderLicenseClaimer,"InvalidLength");
      });

      it("claimPreOrders claims new public licenses and sets the correct on-chain state", async function () {
          const startAmount = ethers.parseEther("10000");
          await admin.PlayFiLicenseSale.setTiers([1,2],[ethers.parseEther("0.1"),ethers.parseEther("0.2")],[1000,1000],[5000,5000]);
          await guardian.PlayFiLicenseSale.setPublicSale(true);

          await deployer.PreOrderLicenseClaimer.claimPreOrders([1000,1000],[1,2]);
          expect(await ethers.provider.getBalance(contracts.PlayFiLicenseSale.getAddress())).to.be.equal(ethers.parseEther("300"));
          expect(await ethers.provider.getBalance(contracts.PreOrderLicenseClaimer.getAddress())).to.be.equal(ethers.parseEther("700"));
          expect(await contracts.PlayFiLicenseSale.publicClaimsPerAddress(contracts.PreOrderLicenseClaimer.getAddress())).to.be.equal(2000);
          let tier1 = await contracts.PlayFiLicenseSale.tiers(1);
          expect(tier1[0]).to.be.equal(ethers.parseEther("0.1"));
          expect(tier1[1]).to.be.equal(1000);
          expect(tier1[2]).to.be.equal(1000);
          expect(tier1[3]).to.be.equal(5000);
          let tier2 = await contracts.PlayFiLicenseSale.tiers(2);
          expect(tier2[0]).to.be.equal(ethers.parseEther("0.2"));
          expect(tier2[1]).to.be.equal(1000);
          expect(tier2[2]).to.be.equal(1000);
          expect(tier2[3]).to.be.equal(5000);
          expect(await contracts.PlayFiLicenseSale.totalLicenses()).to.be.equal(2000);
      });

      it("withdrawing can only be done by the admin", async function () {

          await expect(deployer.PreOrderLicenseClaimer.withdraw()).to.be.revertedWithCustomError(contracts.PreOrderLicenseClaimer,"AccessDenied");

      });


      it("withdrawing transfers all funds to the method caller.", async function () {

          const balanceBefore = await ethers.provider.getBalance(admin.address);

          expect(await ethers.provider.getBalance(contracts.PreOrderLicenseClaimer.getAddress())).to.be.equal(ethers.parseEther("1000"));
          expect(await ethers.provider.getBalance(admin.address)).to.be.equal(balanceBefore);

          const receipt = await (await admin.PreOrderLicenseClaimer.withdraw()).wait();
          const feePaid = receipt!.gasUsed * receipt!.gasPrice;

          expect(await ethers.provider.getBalance(contracts.PreOrderLicenseClaimer.getAddress())).to.be.equal(ethers.parseEther("0"));
          expect(await ethers.provider.getBalance(admin.address)).to.be.equal(balanceBefore - feePaid + ethers.parseEther("1000"));

      });
  });

});
