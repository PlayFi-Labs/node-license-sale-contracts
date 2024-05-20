import * as dotenv from "dotenv";
import { DeployFunction } from "hardhat-deploy/types";
import {Deployer} from "@matterlabs/hardhat-zksync";
import { getNamedAccounts } from "hardhat";
import {Provider, types, utils, Wallet} from "zksync-ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";

dotenv.config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {
        deployerMultisig,
        admin,
        executor,
        playFiLicenseSaleProxy
    } = await getNamedAccounts();

    const contractName = "PreOrderLicenseClaimer";

    const provider = Provider.getDefaultProvider(types.Network.Sepolia);
    const ethProvider = hre.ethers.getDefaultProvider("sepolia");

    const PRIVATE_KEY = process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY !== undefined ? process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY : "";

    const zkWallet = new Wallet(PRIVATE_KEY,provider,ethProvider);

    const deployer = new Deployer(hre, zkWallet);

    const contract = await deployer.loadArtifact(contractName);


    const preOrderLicenseClaimer = await hre.zkUpgrades.deployProxy(deployer.zkWallet, contract, [admin, executor, playFiLicenseSaleProxy], { initializer: "initialize" });

    await preOrderLicenseClaimer.waitForDeployment();

    console.log(contractName + " deployed to:", await preOrderLicenseClaimer.getAddress());

    await hre.zkUpgrades.admin.transferProxyAdminOwnership(deployerMultisig,deployer.zkWallet);

    console.log("Owner of ProxyAdmin set to : " + deployerMultisig);

    return true;
};
export default func;
func.id = "DeployPreOrderLicenseClaimerZKSync";
func.tags = ["DeployPreOrderLicenseClaimerZKSync"];
