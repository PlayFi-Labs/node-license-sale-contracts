import hre, { deployments, getNamedAccounts, getUnnamedAccounts, upgrades } from "hardhat";
import { setupUser, setupUsers } from "./../../accounts";
import {PlayFiLicense} from "../../../../typechain";

export interface Contracts {
  PlayFiLicense: PlayFiLicense;
}

export interface User extends Contracts {
  address: string;
}

// USE ETHEREUM FORK AT 20776237
export const setupIntegration = deployments.createFixture(async ({ ethers }) => {
  const {
    deployer,
    deployerMultisig,
    admin,
  } = await getNamedAccounts();

  const TOP_ETH = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [TOP_ETH],
  });
  const whale = await ethers.provider.getSigner(TOP_ETH);
  await whale.sendTransaction({ to: deployer, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: deployerMultisig, value: ethers.parseEther("10.0") });
  await whale.sendTransaction({ to: admin, value: ethers.parseEther("10.0") });

  const PlayFiLicenseContractFactory = await ethers.getContractFactory("PlayFiLicense");
  const playFiLicense = (await upgrades.deployProxy(PlayFiLicenseContractFactory, [
    admin, deployer
  ])) as unknown as PlayFiLicense;
  await playFiLicense.waitForDeployment();

  const contracts: Contracts = {
    PlayFiLicense: playFiLicense
  };

  const users: User[] = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    contracts,
    deployer: <User>await setupUser(deployer, contracts),
    deployerMultisig: <User>await setupUser(deployerMultisig, contracts),
    admin: <User>await setupUser(admin, contracts),
    users,
  };
});
