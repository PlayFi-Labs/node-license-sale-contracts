import PublicClaimsTree from './claims-tree-public'
import {ethers} from "ethers";

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all claims are included in the tree,
// and the tree has no additional distributions.
interface PublicMerkleDistributorInfo {
  merkleRoot: string
  claims: {
    [accountReferral: string]: {
      index: number
      claimCap: string
      proof: string[]
    }
  }
}

type Allocation = { address: string, claimCap: string, referral: string }

export function parseAllocationsMap(allocations: Allocation[]): PublicMerkleDistributorInfo {
  const dataByAddressAndReferral = allocations.reduce<{
    [accountReferral: string]: { account: string, claimCap: BigInt; referral: string }
  }>((memo, { address: account, claimCap, referral }) => {
    if (!ethers.isAddress(account)) {
      throw new Error(`Found invalid address: ${account}`)
    }
    const parsed = ethers.getAddress(account) + "-" + referral
    if (memo[parsed]) throw new Error(`Duplicate key: ${parsed}`)
    const parsedClaimCap = BigInt(claimCap)
    if (parsedClaimCap < 0) throw new Error(`Invalid claim cap for account: ${account}`)

    memo[parsed] = { account: account, claimCap: parsedClaimCap, referral: referral }
    return memo
  }, {})

  const sortedKeys = Object.keys(dataByAddressAndReferral).sort()

  // construct a tree
  const tree = new PublicClaimsTree(
      sortedKeys.map((parsed) => ({ account: dataByAddressAndReferral[parsed].account, claimCap: dataByAddressAndReferral[parsed].claimCap, referral: dataByAddressAndReferral[parsed].referral }))
  )

  // generate claims
  const claims = sortedKeys.reduce<{
    [accountReferral: string]: { claimCap: string; referral: string; index: number; proof: string[]}
  }>((memo, accountReferral, index) => {
    const { claimCap, referral, account } = dataByAddressAndReferral[accountReferral]
    memo[accountReferral] = {
      index,
      claimCap: claimCap.toString(16),
      referral: referral,
      proof: tree.getProof(index, account, claimCap, referral),
    }
    return memo
  }, {})

  return {
    merkleRoot: tree.getHexRoot(),
    claims
  }
}
