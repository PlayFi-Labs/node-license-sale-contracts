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
            execute: {
                methodName: "initialize",
                args: [admin, deployer, merkleManager, playFiLicense],
            },
            upgradeIndex: 0,
        },
    });

    return true;
};
export default func;
func.id = "DeployPlayFiLicenseMint";
func.tags = ["DeployPlayFiLicenseMint"];
