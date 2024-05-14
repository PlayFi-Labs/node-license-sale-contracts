import * as dotenv from "dotenv";
import hre, { deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";
import { setupUser, setupUsers } from "./../accounts";
import {Provider, types, utils, Wallet} from "zksync-ethers";
import {Deployer} from "@matterlabs/hardhat-zksync";
import { PlayFiLicenseSale} from "../../../typechain";
import "@matterlabs/hardhat-zksync-node/dist/type-extensions";
import {ethers} from "hardhat";

dotenv.config();


export interface Contracts {
  PlayFiLicenseSale: PlayFiLicenseSale;
}

export interface User extends Contracts {
  address: string;
}

// USE ZKSYNC FORK AT 33299846
export const setupIntegration = deployments.createFixture(async ({  }) => {
  const {
    deployer,
    deployerMultisig,
    admin,
    guardian,
    merkleManager,
    referralManager,
  } = await getNamedAccounts();

  const provider = new Provider(hre.network.config.url);

  const TOP_ETH = "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91";
  await provider.send("hardhat_impersonateAccount",[TOP_ETH]);
  let signer = await ethers.getSigner(TOP_ETH);

  const contractName = "PlayFiLicenseSale";
  const PRIVATE_KEY = process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY !== undefined ? process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY : "";
  const zkWallet = new Wallet(PRIVATE_KEY,provider);
  const deployerAccount = new Deployer(hre, zkWallet);
  await signer.sendTransaction({ to: deployerAccount.zkWallet.address, value: ethers.parseEther("10.0") });
  const contract = await deployerAccount.loadArtifact(contractName);
  const playFiLicenseSale = (await hre.zkUpgrades.deployProxy(deployerAccount.zkWallet, contract, [admin, guardian, merkleManager, referralManager], { initializer: "initialize" })) as unknown as PlayFiLicenseSale;
  await playFiLicenseSale.waitForDeployment();

  const contracts: Contracts = {
    PlayFiLicenseSale: playFiLicenseSale,
  };

  const users: User[] = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    contracts,
    provider: <Provider> provider,
    deployer: <User>await setupUser(deployer, contracts),
    deployerMultisig: <User>await setupUser(deployerMultisig, contracts),
    admin: <User>await setupUser(admin, contracts),
    guardian: <User>await setupUser(guardian, contracts),
    merkleManager: <User>await setupUser(merkleManager, contracts),
    referralManager: <User>await setupUser(referralManager, contracts),
    users,
  };
});
