import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import {getContractAddress} from "@ethersproject/address";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const {
        deployer,
        deployerMultisig,
        admin,
        merkleManager
    } = await getNamedAccounts();

    let playFiLicense = (await deployments.get("PlayFiLicense")).address;

    await deploy("PlayFiLicenseMint", {
        contract: "PlayFiLicenseMint",
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
func.id = "UpgradePlayFiLicenseMint2";
func.tags = ["UpgradePlayFiLicenseMint2"];
