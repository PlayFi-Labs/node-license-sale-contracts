import MerkleTree from './merkle-tree'
import {ethers} from "ethers";

export default class PublicClaimsTree {
  private readonly tree: MerkleTree
  constructor(allocations: { account: string; claimCap: BigInt; referral: string }[]) {
    this.tree = new MerkleTree(
      allocations.map(({ account, claimCap, referral}, index) => {
        return PublicClaimsTree.toNode(index, account, claimCap, referral)
      })
    )
  }

  public static verifyProof(
    index: number | BigInt,
    account: string,
    claimCap: BigInt,
    referral: string,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = PublicClaimsTree.toNode(index, account, claimCap, referral)
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item)
    }

    return pair.equals(root)
  }

  // keccak256(abi.encode(index, account, amount))
  public static toNode(index: number | BigInt, account: string, claimCap: BigInt, referral: string): Buffer {
    return Buffer.from(
      ethers.solidityPackedKeccak256(['uint256', 'address', 'uint256', 'string'], [index, account, claimCap, referral]).substr(2),
      'hex'
    )
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot()
  }

  // returns the hex bytes32 values of the proof
  public getProof(index: number | BigInt, account: string, claimCap: BigInt, referral: string): string[] {
    return this.tree.getHexProof(PublicClaimsTree.toNode(index, account, claimCap, referral))
  }
}
