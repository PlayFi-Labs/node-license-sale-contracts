import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const {
        deployer,
        deployerMultisig,
    } = await getNamedAccounts();

    await deploy("PlayFiLicenseSale", {
        contract: "PlayFiLicenseSale",
        from: deployer,
        proxy: {
            owner: deployerMultisig,
            proxyContract: "OpenZeppelinTransparentProxy",
            upgradeIndex: 2,
        },
    });

    return true;
};
export default func;
func.id = "UpgradePlayFiLicenseSale2";
func.tags = ["UpgradePlayFiLicenseSale2"];
