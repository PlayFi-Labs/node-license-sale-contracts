import hre, { deployments, getNamedAccounts, getUnnamedAccounts, upgrades } from "hardhat";
import { setupUser, setupUsers } from "./../accounts";
import { PlayFiLicenseSale } from "../../../typechain";

export interface Contracts {
  PlayFiLicenseSale: PlayFiLicenseSale;
}

export interface User extends Contracts {
  address: string;
}

// USE ARBI ONE FORK AT 203592328
export const setupIntegration = deployments.createFixture(async ({ ethers }) => {
  const {
    deployer,
    deployerMultisig,
    admin,
    guardian,
    merkleManager,
    referralManager,
  } = await getNamedAccounts();

  const TOP_ETH = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [TOP_ETH],
  });
  const whale = await ethers.provider.getSigner(TOP_ETH);
  await whale.sendTransaction({ to: deployer, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: deployerMultisig, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: admin, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: merkleManager, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: referralManager, value: ethers.parseEther("10.0") });
  await deployments.fixture(["DeployPlayFiLicenseSale"]);

  const PlayFiLicenseSaleContractFactory = await ethers.getContractFactory("PlayFiLicenseSale");
  const playFiLicenseSale = (await upgrades.deployProxy(PlayFiLicenseSaleContractFactory, [
    admin,
    guardian, merkleManager, referralManager
  ])) as unknown as PlayFiLicenseSale;
  await playFiLicenseSale.waitForDeployment();

  const contracts: Contracts = {
    PlayFiLicenseSale: playFiLicenseSale,
  };

  const users: User[] = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    contracts,
    deployer: <User>await setupUser(deployer, contracts),
    deployerMultisig: <User>await setupUser(deployerMultisig, contracts),
    admin: <User>await setupUser(admin, contracts),
    guardian: <User>await setupUser(guardian, contracts),
    merkleManager: <User>await setupUser(merkleManager, contracts),
    referralManager: <User>await setupUser(referralManager, contracts),
    users,
  };
});
