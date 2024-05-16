import { ethers } from "hardhat";

export async function getTimestamp() {
  // @ts-ignore
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
}

export function time(timeString: string) {
  return new Date(timeString).getTime();
}

export async function timeTravel(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

export async function timeTravelTo(timestamp: number) {
  const date = new Date();
  date.setTime(timestamp);

  // console.log('Time travelling to', date.toISOString(), date.getTime() / 1000);

  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp / 1000]);
  await ethers.provider.send("evm_mine", []);
}

export async function at(timestamp: string, callback: () => Promise<any>) {
  await timeTravelTo(time(timestamp));

  return await callback();
}

export async function getCurrentTimeStamp(): Promise<number> {
  const blockNumber = await ethers.provider.getBlockNumber();
  // @ts-ignore
  return (await ethers.provider.getBlock(blockNumber)).timestamp;
}
