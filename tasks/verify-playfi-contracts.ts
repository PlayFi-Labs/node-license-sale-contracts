import { task } from "hardhat/config";

import { VERIFYPLAYFICONTRACTS } from "./task-names";
import { NomicLabsHardhatPluginError } from "hardhat/plugins";

task(VERIFYPLAYFICONTRACTS, "Verifies the PlayFi contracts", async (_taskArgs, hre) => {
  const { deployments, upgrades } = hre;

  let playFiLicenseMintImpl = await upgrades.erc1967.getImplementationAddress(
      (
          await deployments.get("PlayFiLicense")
      ).address,
  );

  try {
    await hre.run("verify:verify", {
      address: playFiLicenseMintImpl,
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
