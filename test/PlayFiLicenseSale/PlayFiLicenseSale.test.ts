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

  /*describe("Contract functionality", async function () {
    it("initializing the contract does the correct accounting on chain", async function () {
      expect(
        await contracts.SoulboundBattlefly.hasRole(await contracts.SoulboundBattlefly.ADMIN_ROLE(), dao.address),
      ).to.be.equal(true);
      expect(
        await contracts.SoulboundBattlefly.hasRole(await contracts.SoulboundBattlefly.SIGNER_ROLE(), users[0].address),
      ).to.be.equal(true);
      expect(
        await contracts.SoulboundBattlefly.hasRole(
          await contracts.SoulboundBattlefly.BATTLEFLY_BOT_ROLE(),
          battleflyBot.address,
        ),
      ).to.be.equal(true);
      expect(
        await contracts.SoulboundBattlefly.hasRole(await contracts.SoulboundBattlefly.GUARDIAN_ROLE(), dao.address),
      ).to.be.equal(true);
      expect(await contracts.SoulboundBattlefly.paused()).to.be.equal(true);
      expect(await contracts.SoulboundBattlefly.game()).to.be.equal(contracts.BGStake.address);
    });

    it("minting cannot be done when paused", async function () {
      await expect(users[1].SoulboundBattlefly.mint(true, "0x")).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "ContractPaused",
      );
    });

    it("minting cannot be done for an unexisting battleflyType", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      let contractName = await contracts.SoulboundBattlefly.name();
      let chainId = (await ethers.provider.getNetwork()).chainId;
      let contractAddress = contracts.SoulboundBattlefly.address;
      let data = await generateSignature(
        users[0].address,
        contractName,
        chainId,
        contractAddress,
        1,
        users[1].address,
        2,
        1,
      );
      await expect(users[1].SoulboundBattlefly.mint(true, data)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "InvalidBattleflyType",
      );
    });

    it("minting cannot be done for an inactive battlefly type", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      let contractName = await contracts.SoulboundBattlefly.name();
      let chainId = (await ethers.provider.getNetwork()).chainId;
      let contractAddress = contracts.SoulboundBattlefly.address;
      let data = await generateSignature(
        users[0].address,
        contractName,
        chainId,
        contractAddress,
        1,
        users[1].address,
        1,
        1,
      );
      await expect(users[1].SoulboundBattlefly.mint(true, data)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "TypeNotActive",
      );
    });

    it("minting cannot be done with an invalid signature", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      let contractName = await contracts.SoulboundBattlefly.name();
      let chainId = (await ethers.provider.getNetwork()).chainId;
      let contractAddress = contracts.SoulboundBattlefly.address;
      let data = await generateSignature(
        users[0].address,
        contractName,
        chainId,
        contractAddress,
        1,
        users[1].address,
        1,
        1,
      );
      await users[1].SoulboundBattlefly.mint(false, data);
      await expect(users[1].SoulboundBattlefly.mint(false, data)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "AlreadyMinted",
      );
    });

    it("minting without stake transfers the tokens to the minters address and does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      let contractName = await contracts.SoulboundBattlefly.name();
      let chainId = (await ethers.provider.getNetwork()).chainId;
      let contractAddress = contracts.SoulboundBattlefly.address;
      let data = await generateSignature(
        users[0].address,
        contractName,
        chainId,
        contractAddress,
        1,
        users[1].address,
        1,
        1,
      );
      await users[1].SoulboundBattlefly.mint(false, data);
      expect(await contracts.SoulboundBattlefly.currentId()).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.balanceOf(users[1].address)).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.ownerOf(1)).to.be.equal(users[1].address);
    });

    it("minting with staking transfers the tokens to the game contract and does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await deployer.BGAdmin.unpause();
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await dao.SoulboundBattlefly.whitelistReceiverAddress(contracts.BGStake.address, true);
      let contractName = await contracts.SoulboundBattlefly.name();
      let chainId = (await ethers.provider.getNetwork()).chainId;
      let contractAddress = contracts.SoulboundBattlefly.address;
      let data = await generateSignature(
        users[0].address,
        contractName,
        chainId,
        contractAddress,
        1,
        users[1].address,
        1,
        1,
      );
      await users[1].SoulboundBattlefly.mint(true, data);
      expect(await contracts.SoulboundBattlefly.currentId()).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.balanceOf(users[1].address)).to.be.equal(0);
      expect(await contracts.SoulboundBattlefly.balanceOf(contracts.BGStake.address)).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.ownerOf(1)).to.be.equal(contracts.BGStake.address);
    });

    it("whitelist minting cannot be done when paused", async function () {
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(1, users[1].address, 1, 1, true, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "ContractPaused");
    });

    it("whitelist minting cannot be done for an unexisting battleflyType", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(1, users[1].address, 1, 1, true, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "InvalidBattleflyType");
    });

    it("whitelist minting cannot be done for an inactive battlefly type", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(1, users[1].address, 1, 1, true, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "TypeNotActive");
    });

    it("whitelist minting cannot be done for an already used merkleroot + index combo", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, false, []);
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, false, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "AlreadyMintedWhitelist");
    });

    it("whitelist minting cannot be done if the total amount of mints for a specific type has already been used for that minter", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0x8d17d8e719a685e3bd78d04a5d88c002a8a98ced3eb8d92b3f7a3a65b712b14c",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 3, 1, false, []);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xe1461c6edc772eda71cd839c2c24ec1293510f7d9c7c94b9556cb7983e216348",
      );
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 2, 1, false, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "AlreadyMintedFullAllocationForWhitelist");
    });

    it("whitelist minting cannot be done with an invalid proof", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await expect(
        users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 2, 1, false, []),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "InvalidProof");
    });

    it("whitelist minting without stake transfers the tokens to the minters address and does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, false, []);
      expect(await contracts.SoulboundBattlefly.currentId()).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.balanceOf(users[1].address)).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.ownerOf(1)).to.be.equal(users[1].address);
    });

    it("whitelist minting with staking transfers the tokens to the game contract and does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await deployer.BGAdmin.unpause();
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await dao.SoulboundBattlefly.whitelistReceiverAddress(contracts.BGStake.address, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, true, []);
      expect(await contracts.SoulboundBattlefly.currentId()).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.balanceOf(users[1].address)).to.be.equal(0);
      expect(await contracts.SoulboundBattlefly.balanceOf(contracts.BGStake.address)).to.be.equal(1);
      expect(await contracts.SoulboundBattlefly.ownerOf(1)).to.be.equal(contracts.BGStake.address);
    });

    it("setting the merkleroot for a battlefly type can only be done by the battefly bot", async function () {
      await expect(
        users[1].SoulboundBattlefly.setMerklerootForType(
          1,
          "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
        ),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "AccessDenied");
    });

    it("setting the merkleroot for a battlefly type can only be done by the battefly bot", async function () {
      await expect(
        battleflyBot.SoulboundBattlefly.setMerklerootForType(
          1,
          "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
        ),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "InvalidBattleflyType");
    });

    it("setting the merkleroot for a battlefly type does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.getMerklerootForType(1);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      expect(await battleflyBot.SoulboundBattlefly.getMerklerootForType(1)).to.be.equal(
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
    });

    it("adding a type can only be done by the battelfly bot", async function () {
      await expect(users[1].SoulboundBattlefly.addType()).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "AccessDenied",
      );
    });

    it("adding a type cannot be done when paused", async function () {
      await expect(battleflyBot.SoulboundBattlefly.addType()).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "ContractPaused",
      );
    });

    it("adding a type does the correct accounting on-chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      expect(await battleflyBot.SoulboundBattlefly.battleflyTypeCounter()).to.be.equal(1);
    });

    it("setting the type status can only be done by the battlefly bot", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await expect(users[1].SoulboundBattlefly.setTypeStatus(1, true)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "AccessDenied",
      );
    });

    it("setting the type status cannot be done for an unexisting battlefly type", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await expect(battleflyBot.SoulboundBattlefly.setTypeStatus(1, true)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "InvalidBattleflyType",
      );
    });

    it("setting the type status does the correct accounting on chain", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      expect(await battleflyBot.SoulboundBattlefly.isActiveType(1)).to.be.equal(false);
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      expect(await battleflyBot.SoulboundBattlefly.isActiveType(1)).to.be.equal(true);
    });

    it("pausing can only be done by guardians", async function () {
      await expect(users[1].SoulboundBattlefly.setPaused(true)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "AccessDenied",
      );
    });

    it("pausing does the correct accounting on-chain", async function () {
      expect(await contracts.SoulboundBattlefly.paused()).to.be.equal(true);
      await dao.SoulboundBattlefly.setPaused(false);
      expect(await contracts.SoulboundBattlefly.paused()).to.be.equal(false);
    });

    it("whitelisting receiver addresses can only be done by the admin", async function () {
      await expect(
        users[1].SoulboundBattlefly.whitelistReceiverAddress(users[1].address, true),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "AccessDenied");
    });

    it("whitelisting receiver addresses does the correct acounting on-chain", async function () {
      expect(await contracts.SoulboundBattlefly.isWhitelistedReceiverAddress(users[1].address)).to.be.equal(false);
      await dao.SoulboundBattlefly.whitelistReceiverAddress(users[1].address, true);
      expect(await contracts.SoulboundBattlefly.isWhitelistedReceiverAddress(users[1].address)).to.be.equal(true);
    });

    it("isActiveType returns whether a battlefly type is active", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      expect(await battleflyBot.SoulboundBattlefly.isActiveType(1)).to.be.equal(false);
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      expect(await battleflyBot.SoulboundBattlefly.isActiveType(1)).to.be.equal(true);
    });

    it("soulbound battleflies are not transferable to non-witelisted receiver addresses or non-owners of the soulbound tokens.", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, false, []);
      await expect(
        users[1].SoulboundBattlefly.transferFrom(users[1].address, users[2].address, 1),
      ).to.be.revertedWithCustomError(contracts.SoulboundBattlefly, "TransferNotAllowed");
    });

    it("tokenURI cannot be retrieved for unexisting tokens", async function () {
      await expect(contracts.SoulboundBattlefly.tokenURI(1)).to.be.revertedWithCustomError(
        contracts.SoulboundBattlefly,
        "UnexistingToken",
      );
    });

    it("tokenURI returns the correct token uri", async function () {
      await dao.SoulboundBattlefly.setPaused(false);
      await battleflyBot.SoulboundBattlefly.addType();
      await battleflyBot.SoulboundBattlefly.setTypeStatus(1, true);
      await battleflyBot.SoulboundBattlefly.setMerklerootForType(
        1,
        "0xd9b120cd7470d194c1d5d4e9a82616558c1bce1e33bed2b1ea313e54aa82b017",
      );
      await users[1].SoulboundBattlefly.mintWhitelist(0, users[1].address, 1, 1, false, []);
      expect(await contracts.SoulboundBattlefly.tokenURI(1)).to.be.equal(
        "https://alpha-graph.battlefly.game/soulbounds/1/metadata",
      );
    });
  });*/

});
