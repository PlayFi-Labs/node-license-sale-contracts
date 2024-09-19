import {parseEther, Wallet} from "ethers";
import hre, { ethers, upgrades } from "hardhat";
import { Contracts, setupIntegration } from "../_helpers/evm/licenses/index_license";
import { expect } from "chai";
import { User } from "../_helpers/evm/licenses/index_license";
import {PlayFiLicense} from "../../typechain";

describe("PlayFiLicense", () => {
  let contracts: Contracts;
  let deployer: User;
  let deployerMultisig: User;
  let admin: User;
  let guardian: User;
  let merkleManager: User;
  let licenseManager: User;
  let users: User[];

  beforeEach(async () => {
    //await ethers.provider.send("hardhat_reset", []);
    ({ contracts, deployer, deployerMultisig, admin, users } =
      await setupIntegration());
  });

  describe("Contract Functionality", async function () {
    it("admin address cannot be 0 on initializing", async function () {
      await expect(
        upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicense"), [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
        ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });

    it("licenseManager address cannot be 0 on initializing", async function () {
      await expect(
          upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicense"), [
            admin.address,
            ethers.ZeroAddress,
          ]),
      ).to.be.revertedWithCustomError(contracts.PlayFiLicense, "InvalidAddress");
    });

    it("initializing the contract sets the correct on-chain states", async function () {
      const playFiLicense = await upgrades.deployProxy(await ethers.getContractFactory("PlayFiLicense"), [
        admin.address,
        deployer.address
      ]) as unknown as PlayFiLicense;
      await playFiLicense.waitForDeployment();
      const adminRole = await playFiLicense.ADMIN_ROLE();
      const licenseManagerRole = await playFiLicense.LICENSE_MANAGER_ROLE();
      expect(await playFiLicense.hasRole(adminRole, admin.address)).to.be.equal(true);
      expect(await playFiLicense.hasRole(adminRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicense.hasRole(licenseManagerRole, deployer.address)).to.be.equal(true);
      expect(await playFiLicense.hasRole(licenseManagerRole, users[10].address)).to.be.equal(false);
      expect(await playFiLicense.symbol()).to.be.equal("PLAYFI_NODE_LICENSE");
      expect(await playFiLicense.name()).to.be.equal("PlayFi Node License");
    });

      it("minting licenses can only be done by the license manager", async function () {
          await expect(users[10].PlayFiLicense.mint(users[10].address, 5)).to.be.revertedWithCustomError(contracts.PlayFiLicense,"AccessDenied");
      });

      it("minting a license mints an amount of licenses to the defined address and sets the correct state", async function () {
        expect(await deployer.PlayFiLicense.mint(users[10].address, 5)).to.emit(contracts.PlayFiLicense,"LicenseMinted").withArgs(users[10].address,5);
        expect(await contracts.PlayFiLicense.currentLicenseId()).to.be.equal(5);
        expect(await contracts.PlayFiLicense.totalSupply()).to.be.equal(5);
        expect(await contracts.PlayFiLicense.balanceOf(users[10].address)).to.be.equal(5);
      });

    it("Licenses are soulbound and cannot be transfered", async function () {
      await deployer.PlayFiLicense.mint(users[10].address, 1);
      await expect(users[10].PlayFiLicense.transferFrom(users[10].address,users[9].address,1)).to.be.revertedWithCustomError(contracts.PlayFiLicense,"TransferNotAllowed").withArgs(users[10].address,users[9].address,1);
    });

    it("tokenURI does not work for unexisting tokens", async function () {
      await expect(contracts.PlayFiLicense.tokenURI(1)).to.be.revertedWithCustomError(contracts.PlayFiLicense,"UnexistingToken").withArgs(1);
    });

    it("tokenURI returns the correct token url", async function () {
      await deployer.PlayFiLicense.mint(users[10].address, 5);
      expect(await contracts.PlayFiLicense.tokenURI(1)).to.be.equal("data:application/json;base64,eyJuYW1lIjogIkxpY2Vuc2UgIzEiLCAiZGVzY3JpcHRpb24iOiAiUGxheUZpIE5vZGUgTGljZW5zZSIsICJpbWFnZSI6ICJkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBITjJaeUIzYVdSMGFEMG5OVEF3SnlCb1pXbG5hSFE5SnpVd01DY2dkbWxsZDBKdmVEMG5MVEkxTUNBdE16QWdNVEF3TUNBeE1EQXdKeUJtYVd4c1BTZHViMjVsSnlCemRIbHNaVDBuWW1GamEyZHliM1Z1WkMxamIyeHZjam9qTURBd0p5QjRiV3h1Y3owbmFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1qQXdNQzl6ZG1jbklIaHRiRzV6T25oc2FXNXJQU2RvZEhSd09pOHZkM2QzTG5jekxtOXlaeTh4T1RrNUwzaHNhVzVySno0OGRHVjRkQ0I0UFNjdE1UVXdKeUI1UFNjMk16QW5JR1p2Ym5RdGMybDZaVDBuTXpBbklHWnBiR3c5SnlObVptWW5JR1p2Ym5RdFptRnRhV3g1UFNkSmJuUmxjaTF1TENCellXNXpMWE5sY21sbUp6NVFiR0Y1Um1rZ1RtOWtaU0JNYVdObGJuTmxJRWxrT2lBeFBDOTBaWGgwUGp4MFpYaDBJSGc5SnkweE5UQW5JSGs5Snpjd01DY2dabTl1ZEMxemFYcGxQU2N6TUNjZ1ptbHNiRDBuSTJabVppY2dabTl1ZEMxbVlXMXBiSGs5SjBsdWRHVnlMVzRzSUhOaGJuTXRjMlZ5YVdZblBrOTNibVZ5T2lBd2VESTFORFppWTJRell6ZzBOakl4WlRrM05tUTRNVGcxWVRreFlUa3lNbUZsTnpkbFkyVmpNekE4TDNSbGVIUStQSFJsZUhRZ2VEMG5MVEUxTUNjZ2VUMG5OemN3SnlCbWIyNTBMWE5wZW1VOUp6TXdKeUJtYVd4c1BTY2pabVptSnlCbWIyNTBMV1poYldsc2VUMG5TVzUwWlhJdGJpd2djMkZ1Y3kxelpYSnBaaWMrSXlCTWFXTmxibk5sY3lCUGQyNWxaQ0JpZVNCMGFHVWdUM2R1WlhJNklEVThMM1JsZUhRK1BIUmxlSFFnWm05dWRDMXphWHBsUFNjeE5TNDFKeUJtYVd4c1BTY2pabVptSnlCbWIyNTBMWE4wZVd4bFBTZHBkR0ZzYVdNbklHWnZiblF0Wm1GdGFXeDVQU2RKYm5SbGNpMXVMQ0J6WVc1ekxYTmxjbWxtSno0OGRITndZVzRnZUQwbkxUSXdNQ2NnZVQwbk9EWXdKejVEYjNCNWNtbG5hSFFnTWpBeU5DQlFiR0Y1UmtrZ1JtOTFibVJoZEdsdmJqd3ZkSE53WVc0K0lEeDBjM0JoYmlCNFBTY3RNakF3SnlCNVBTYzVNREFuUGxSb1pTQk9iMlJsSUZOdlpuUjNZWEpsSUdseklHeHBZMlZ1YzJWa0lIVnVaR1Z5SUhSb1pTQlFiR0Y1Um1rZ2JHbGpaVzV6WlNCc2IyTmhkR1ZrSUdGMElEeGhJR1pwYkd3OUp5Tm1abVluSUhoc2FXNXJPbWh5WldZOUoyaDBkSEJ6T2k4dmQzZDNMbkJzWVhsbWFTNWhhUzl3YkdGNVpta3RibTlrWlMxemIyWjBkMkZ5WlMxc2FXTmxibk5sSno1b2RIUndjem92TDNkM2R5NXdiR0Y1Wm1rdVlXa3ZjR3hoZVdacExXNXZaR1V0YzI5bWRIZGhjbVV0YkdsalpXNXpaVHd2WVQ0Z0tDWnhkVzkwTzB4cFkyVnVjMlVtY1hWdmREc3BMaUE4TDNSemNHRnVQaUE4ZEhOd1lXNGdlRDBuTFRJd01DY2dlVDBuT1RJd0p6NVpiM1VnYldGNUlHOXViSGtnZFhObElIUm9aU0JPYjJSbElGTnZablIzWVhKbElHbHVJR0ZqWTI5eVpHRnVZMlVnZDJsMGFDQjBhR1VnWTI5dVpHbDBhVzl1Y3lCelpYUWdabTl5ZEdnZ2FXNGdkR2hsSUV4cFkyVnVjMlV1SUR3dmRITndZVzQrSUNBOGRITndZVzRnZUQwbkxUSXdNQ2NnZVQwbk9UUXdKejRnV1c5MUlHMWhlU0J2WW5SaGFXNGdZU0JqYjNCNUlHOW1JSFJvWlNCT2IyUmxJRk52Wm5SM1lYSmxJR0YwSUZ0cGJuTmxjblFnVlZKTVhTNDhMM1J6Y0dGdVBqd3ZkR1Y0ZEQ0OGNHRjBhQ0JrUFNkTk5ERXpMakU1TWlBek56WXVNRGMxSURJek9DNHhPU0EwTnpjdU1URXliQzB6TkM0ME1URXRNVGt1T0RZM2RqY3lMamsyTkd3ek5DNDBNVEVnTVRrdU9EWTRJREl6T0M0eE9TMHhNemN1TlRKV01UTTNMalV4T1V3eU16Z3VNVGtnTUNBd0lERXpOeTQxTVRsMk1qYzFMakF6T0d3eE5qa3VNelk0SURrM0xqYzROVll5TXpVdU16QXpiRFk0TGpneU1TMHpPUzQzTXpRZ05qZ3VPREl4SURNNUxqY3pOSFkzT1M0ME5qaHNMVFk0TGpneU1TQXpPUzQzTXpRdE16UXVOREV4TFRFNUxqZzJOM1kzTWk0NU5qUnNNelF1TkRFeElERTVMamcyTnlBeE16SXVNREV0TnpZdU1qRTJWakU1T0M0NE1qRnNMVEV6TWk0d01TMDNOaTR5TVRZdE1UTXlMakF4SURjMkxqSXhObll5TURJdU1EYzFiQzAwTWk0NU9TMHlOQzQ0TWpGV01UYzBMakF3TVV3eU16Z3VNVGtnTnpJdU9UWTBiREUzTlM0d01ESWdNVEF4TGpBek4zb25JR1pwYkd3OUp5Tm1abVluTHo0OGNHRjBhQ0JrUFNkTk5ERXpMakU1TWlBek56WXVNRGMxSURJek9DNHhPU0EwTnpjdU1URXliQzB6TkM0ME1URXRNVGt1T0RZM2RqY3lMamsyTkd3ek5DNDBNVEVnTVRrdU9EWTRJREl6T0M0eE9TMHhNemN1TlRKV01UTTNMalV4T1V3eU16Z3VNVGtnTUNBd0lERXpOeTQxTVRsMk1qYzFMakF6T0d3eE5qa3VNelk0SURrM0xqYzROVll5TXpVdU16QXpiRFk0TGpneU1TMHpPUzQzTXpRZ05qZ3VPREl4SURNNUxqY3pOSFkzT1M0ME5qaHNMVFk0TGpneU1TQXpPUzQzTXpRdE16UXVOREV4TFRFNUxqZzJOM1kzTWk0NU5qUnNNelF1TkRFeElERTVMamcyTnlBeE16SXVNREV0TnpZdU1qRTJWakU1T0M0NE1qRnNMVEV6TWk0d01TMDNOaTR5TVRZdE1UTXlMakF4SURjMkxqSXhObll5TURJdU1EYzFiQzAwTWk0NU9TMHlOQzQ0TWpGV01UYzBMakF3TVV3eU16Z3VNVGtnTnpJdU9UWTBiREUzTlM0d01ESWdNVEF4TGpBek4zb25JR1pwYkd3OUozVnliQ2dqWVNrbkx6NDhaR1ZtY3o0OGJHbHVaV0Z5UjNKaFpHbGxiblFnYVdROUoyRW5JSGd4UFNjME9EZ3VNemc1SnlCNU1UMG5PQzR4TXpFbklIZ3lQU2N0TVRjNUxqQTBOQ2NnZVRJOUp6UTRPUzQ1TURrbklHZHlZV1JwWlc1MFZXNXBkSE05SjNWelpYSlRjR0ZqWlU5dVZYTmxKejQ4YzNSdmNDQnpkRzl3TFdOdmJHOXlQU2NqUmtaRk56QkdKeTgrUEhOMGIzQWdiMlptYzJWMFBTY3VNemMwSnlCemRHOXdMV052Ykc5eVBTY2pSa1kwUkVRNEp5OCtQSE4wYjNBZ2IyWm1jMlYwUFNjdU9EQTJKeUJ6ZEc5d0xXTnZiRzl5UFNjak5EWTROVVpHSnk4K1BDOXNhVzVsWVhKSGNtRmthV1Z1ZEQ0OEwyUmxabk0rUEM5emRtYysiLCAiYXR0cmlidXRlcyI6IFt7InRyYWl0X3R5cGUiOiAiT3duZXIiLCAidmFsdWUiOiAiMHgyNTQ2YmNkM2M4NDYyMWU5NzZkODE4NWE5MWE5MjJhZTc3ZWNlYzMwIn0sIHsidHJhaXRfdHlwZSI6ICJMZWdhbCIsICJ2YWx1ZSI6ICJDb3B5cmlnaHQgMjAyNCBQbGF5RkkgRm91bmRhdGlvbi4gVGhlIE5vZGUgU29mdHdhcmUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIFBsYXlGaSBsaWNlbnNlIGxvY2F0ZWQgYXQgaHR0cHM6Ly93d3cucGxheWZpLmFpL3BsYXlmaS1ub2RlLXNvZnR3YXJlLWxpY2Vuc2UgKCJMaWNlbnNlIikuIFlvdSBtYXkgb25seSB1c2UgdGhlIE5vZGUgU29mdHdhcmUgaW4gYWNjb3JkYW5jZSB3aXRoIHRoZSBjb25kaXRpb25zIHNldCBmb3J0aCBpbiB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBOb2RlIFNvZnR3YXJlIGF0IFtpbnNlcnQgVVJMXS4ifV19");
    });
  });

});
