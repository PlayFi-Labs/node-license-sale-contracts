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
        guardian,
        merkleManager,
        referralManager
    } = await getNamedAccounts();

    await deploy("PlayFiLicenseSale", {
        contract: "PlayFiLicenseSale",
        from: deployer,
        proxy: {
            owner: deployerMultisig,
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                methodName: "initialize",
                args: [admin, guardian, merkleManager, referralManager],
            },
            upgradeIndex: 0,
        },
    });

    return true;
};
export default func;
func.id = "DeployPlayFiLicenseSale";
func.tags = ["DeployPlayFiLicenseSale"];
