import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const {
        deployer,
        deployerMultisig,
        admin,
        executor,
        playFiLicenseSaleProxy
    } = await getNamedAccounts();

    await deploy("PreOrderLicenseClaimer", {
        contract: "PreOrderLicenseClaimer",
        from: deployer,
        proxy: {
            owner: deployerMultisig,
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                methodName: "initialize",
                args: [admin, executor, playFiLicenseSaleProxy],
            },
            upgradeIndex: 0,
        },
    });

    return true;
};
export default func;
func.id = "DeployPreOrderLicenseClaimerEVM";
func.tags = ["DeployPreOrderLicenseClaimerEVM"];
