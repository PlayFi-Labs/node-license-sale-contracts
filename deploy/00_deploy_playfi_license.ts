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
        admin
    } = await getNamedAccounts();

    const deployerSigner = await hre.ethers.provider.getSigner(deployer);
    const transactionCount = await deployerSigner.getNonce();
    const futureLicenseManagerAddress = getContractAddress({
        from: deployer,
        nonce: transactionCount + 3,
    });

    await deploy("PlayFiLicense", {
        contract: "PlayFiLicense",
        from: deployer,
        proxy: {
            owner: deployerMultisig,
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                methodName: "initialize",
                args: [admin, futureLicenseManagerAddress],
            },
            upgradeIndex: 0,
        },
    });

    console.log(futureLicenseManagerAddress);

    return true;
};
export default func;
func.id = "DeployPlayFiLicense";
func.tags = ["DeployPlayFiLicense"];
