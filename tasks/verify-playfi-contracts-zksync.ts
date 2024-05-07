import { task } from "hardhat/config";

import { VERIFYPLAYFICONTRACTSZKSYNC } from "./task-names";
import { NomicLabsHardhatPluginError } from "hardhat/plugins";
import {getImplementationAddress} from "@openzeppelin/upgrades-core";
import {Provider, types} from "zksync-ethers";

task(VERIFYPLAYFICONTRACTSZKSYNC, "Verifies the PlayFi contracts", async (_taskArgs, hre) => {
  const { deployments, upgrades } = hre;

  const {
    playFiLicenseSaleProxy
  } = await hre.getNamedAccounts();

  const provider = Provider.getDefaultProvider(types.Network.Sepolia);

  let playFiLicenseSaleImpl = await getImplementationAddress(provider,playFiLicenseSaleProxy
  );

  try {
    await hre.run("verify:verify", {
      address: playFiLicenseSaleImpl,
      constructorArguments: [],
    });
  } catch (e) {
    // @ts-ignore
    if (e.name === "NomicLabsHardhatPluginError" && e.message.indexOf("Contract source code already verified") !== -1) {
      console.log("Contract source already verified!");
    } else {
      console.log(e);
    }
  }

});
