import ClaimsTree from './claims-tree'
import {ethers} from "ethers";

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all claims are included in the tree,
// and the tree has no additional distributions.
interface MerkleDistributorInfo {
  merkleRoot: string
  claims: {
    [account: string]: {
      index: number
      claimCap: string
      proof: string[]
    }
  }
}

type Allocation = { address: string, claimCap: string }

export function parseAllocationsMap(allocations: Allocation[]): MerkleDistributorInfo {
  const dataByAddress = allocations.reduce<{
    [address: string]: { claimCap: BigInt; }
  }>((memo, { address: account, claimCap }) => {
    if (!ethers.isAddress(account)) {
      throw new Error(`Found invalid address: ${account}`)
    }
    const parsed = ethers.getAddress(account)
    if (memo[parsed]) throw new Error(`Duplicate address: ${parsed}`)
    const parsedClaimCap = BigInt(claimCap)
    if (parsedClaimCap < 0) throw new Error(`Invalid claim cap for account: ${account}`)

    memo[parsed] = { claimCap: parsedClaimCap }
    return memo
  }, {})

  const sortedAddresses = Object.keys(dataByAddress).sort()

  // construct a tree
  const tree = new ClaimsTree(
    sortedAddresses.map((address) => ({ account: address, claimCap: dataByAddress[address].claimCap }))
  )

  // generate claims
  const claims = sortedAddresses.reduce<{
    [address: string]: { claimCap: string; index: number; proof: string[]}
  }>((memo, address, index) => {
    const { claimCap } = dataByAddress[address]
    memo[address] = {
      index,
      claimCap: claimCap.toString(16),
      proof: tree.getProof(index, address, claimCap),
    }
    return memo
  }, {})

  return {
    merkleRoot: tree.getHexRoot(),
    claims
  }
}
