import {parseEther, Wallet} from "ethers";
import hre, { ethers, upgrades } from "hardhat";
import { Contracts, setupIntegration } from "../_helpers/evm/licenses/index_license_mint";
import { expect } from "chai";
import { User } from "../_helpers/evm/licenses/index_license_mint";
import {PlayFiLicense, PlayFiLicenseMint} from "../../typechain";
import ClaimsTree from "../../scripts/merkle-tree/claims-tree";

const ONE_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000001'
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'


describe("PlayFiLicense", () => {
  let contracts: Contracts;
  let deployer: User;
  let deployerMultisig: User;
  let admin: User;
  let users: User[];

  beforeEach(async () => {
    //await ethers.provider.send("hardhat_reset", []);
    ({ contracts, deployer, deployerMultisig, admin, users } =
      await setupIntegration());
  });

  describe("Contract Functionality", async function () {
    it("admin address cannot be 0 on initializing", async function () {
      await expect(
        upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseMint"), [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
        ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });

    it("guardian address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseMint"), [
            admin.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });

    it("merkle manager address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseMint"), [
            admin.address,
            deployer.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });

    it("playfi license contract address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseMint"), [
            admin.address,
            deployer.address,
            admin.address,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });


    it("initializing the contract sets the correct on-chain states", async function () {
      const playFiLicenseMint = await upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicenseMint"), [
        admin.address,
        deployer.address,
          admin.address,
          await contracts.PlayFiLicense.getAddress()
      ]) as unknown as PlayFiLicenseMint;
      await playFiLicenseMint.waitForDeployment();
      const adminRole = await playFiLicenseMint.ADMIN_ROLE();
      const guardianRole = await playFiLicenseMint.GUARDIAN_ROLE();
      const merkleManagerRole = await playFiLicenseMint.MERKLE_MANAGER_ROLE();
      expect(await playFiLicenseMint.hasRole(adminRole, admin.address)).to.be.equal(true);
      expect(await playFiLicenseMint.hasRole(adminRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseMint.hasRole(guardianRole, deployer.address)).to.be.equal(true);
      expect(await playFiLicenseMint.hasRole(guardianRole, admin.address)).to.be.equal(true);
      expect(await playFiLicenseMint.hasRole(guardianRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseMint.hasRole(merkleManagerRole, admin.address)).to.be.equal(true);
      expect(await playFiLicenseMint.hasRole(merkleManagerRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicenseMint.paused()).to.be.equal(true);
      expect(await playFiLicenseMint.playFiLicense()).to.be.equal(await contracts.PlayFiLicense.getAddress());
    });

      it("setting the mint merkle root can only be done by the merkle manager", async function () {
          await expect(users[10].PlayFiLicenseMint.setMintMerkleRoot(ONE_BYTES32)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"AccessDenied");
      });

      it("setting the mint merkle root updates the correct state", async function () {
          expect(await contracts.PlayFiLicenseMint.mintMerkleRoot()).to.be.equal(ZERO_BYTES32);
          await admin.PlayFiLicenseMint.setMintMerkleRoot(ONE_BYTES32);
          expect(await contracts.PlayFiLicenseMint.mintMerkleRoot()).to.be.equal(ONE_BYTES32);
      });

      it("pausing the contract can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseMint.setPaused(true)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"AccessDenied");
      });

      it("unpausing the contract can only be done by the guardian", async function () {
          await expect(users[10].PlayFiLicenseMint.setPaused(false)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"AccessDenied");
      });

      it("pausing the contract sets the correct contract state", async function () {
          await admin.PlayFiLicenseMint.setPaused(false);
          expect(await contracts.PlayFiLicenseMint.paused()).to.be.equal(false);
          await admin.PlayFiLicenseMint.setPaused(true);
          expect(await contracts.PlayFiLicenseMint.paused()).to.be.equal(true);
      });

      it("unpausing the contract sets the correct contract state", async function () {
          expect(await contracts.PlayFiLicenseMint.paused()).to.be.equal(true);
          await admin.PlayFiLicenseMint.setPaused(false);
          expect(await contracts.PlayFiLicenseMint.paused()).to.be.equal(false);
      });

      it("minting licenses can only be done when the contract is not paused", async function () {
          await expect(users[10].PlayFiLicenseMint.mintLicenses(users[10].address,"0x",1,[],"0x")).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"ContractPaused");
      });

      it("minting more licenses than the claim cap is not possible, even in 2 times", async function () {
          await admin.PlayFiLicenseMint.setPaused(false);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await admin.PlayFiLicenseMint.setMintMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          await expect(users[10].PlayFiLicenseMint.mintLicenses(users[10].address,data,3,proof,"0x")).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"MintCapExceeded");
          const signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,2,proof,signature);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"MintCapExceeded");
      });

      it("minting licenses cannot be done for an invalid proof", async function () {
          await admin.PlayFiLicenseMint.setPaused(false);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await admin.PlayFiLicenseMint.setMintMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(1, users[9].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          const signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidProof");
      });

      it("minting licenses cannot be done for an invalid signature", async function () {
          await admin.PlayFiLicenseMint.setPaused(false);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await admin.PlayFiLicenseMint.setMintMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          let signature = await generateSignature(users[10].address, "PlayFiLicenseMin", 1, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidSignature");
          signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 421614, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidSignature");
          signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicense.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidSignature");
          signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicenseMint.getAddress(), "You allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidSignature");
          signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[10].address);
          await expect(users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,1,proof,signature)).to.be.revertedWithCustomError(contracts.PlayFiLicenseMint,"InvalidSignature");
      });

      it("minting licenses mints the licenses to the sender address and updates the contract state", async function () {
          await admin.PlayFiLicenseMint.setPaused(false);
          let tree = new ClaimsTree([
              {account: users[10].address, claimCap: BigInt("2")},
              {account: users[9].address, claimCap: BigInt("2")}
          ]);
          await admin.PlayFiLicenseMint.setMintMerkleRoot(tree.getHexRoot());
          const proof = tree.getProof(0, users[10].address, BigInt("2"));
          const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","uint256"],[0,2]);
          let signature = await generateSignature(users[10].address, "PlayFiLicenseMint", 1, await contracts.PlayFiLicenseMint.getAddress(), "I allow my licenses to be minted on Ethereum L1 with the following address. Make sure you have ownership over this address on Ethereum L1!", users[9].address);
          expect(await contracts.PlayFiLicenseMint.licensesMintedPerAddress(users[10].address)).to.be.equal(0);
          expect(await contracts.PlayFiLicense.currentLicenseId()).to.be.equal(0);
          expect(await contracts.PlayFiLicense.totalSupply()).to.be.equal(0);
          expect(await contracts.PlayFiLicense.balanceOf(users[9].address)).to.be.equal(0);
          expect(await users[9].PlayFiLicenseMint.mintLicenses(users[10].address,data,2,proof,signature)).to.emit(contracts.PlayFiLicenseMint,"LicensesMinted").withArgs(users[10].address, users[9].address, 2);
          expect(await contracts.PlayFiLicenseMint.licensesMintedPerAddress(users[10].address)).to.be.equal(2);
          expect(await contracts.PlayFiLicense.currentLicenseId()).to.be.equal(2);
          expect(await contracts.PlayFiLicense.totalSupply()).to.be.equal(2);
          expect(await contracts.PlayFiLicense.balanceOf(users[9].address)).to.be.equal(2);
      });
  });

    async function generateSignature(
        signerAddress: string,
        contractName: string,
        chainId: number,
        contractAddress: string,
        message: string,
        minterAddress: string,
    ): Promise<string> {
        let signer = await ethers.getSigner(signerAddress);
        const signature = await signer.signTypedData(
            // Domain
            {
                name: contractName,
                version: "1.0.0",
                chainId: chainId,
                verifyingContract: contractAddress,
            },
            // Types
            {
                Mint: [
                    { name: "message", type: "string" },
                    { name: "minter", type: "address" }
                ],
            },
            // Value
            { message: message, minter: minterAddress },
        );
        return signature;
    }

});
