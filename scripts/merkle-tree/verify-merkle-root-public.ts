import { program } from 'commander'
import fs from 'fs'
import PublicClaimTree from './claims-tree-public'
import {ethers} from "ethers";

program
  .version('0.0.0')
  .requiredOption(
    '-i, --input <path>',
    'input JSON file location containing the merkle proofs for each account and the merkle root'
  )

program.parse(process.argv)
const options = program.opts()
const json = JSON.parse(fs.readFileSync(options.input, { encoding: 'utf8' }))

const combinedHash = (first: Buffer, second: Buffer): Buffer => {
  if (!first) {
    return second
  }
  if (!second) {
    return first
  }

  return Buffer.from(
    ethers.solidityPackedKeccak256(['bytes32', 'bytes32'], [first, second].sort(Buffer.compare)).slice(2),
    'hex'
  )
}

const verifyProof = (
  index: number | BigInt,
  account: string,
  claimCap: BigInt,
  referral: string,
  proof: Buffer[],
  root: Buffer
): boolean => {
  let pair = PublicClaimTree.toNode(index, account, claimCap, referral)
  for (const item of proof) {
    pair = combinedHash(pair, item)
  }

  return pair.equals(root)
}

const getNextLayer = (elements: Buffer[]): Buffer[] => {
  return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
    if (idx % 2 === 0) {
      // Hash the current element with its pair element
      layer.push(combinedHash(el, arr[idx + 1]))
    }

    return layer
  }, [])
}

const getRoot = (allocations: { account: string; claimCap: BigInt; referral: string, index: number}[]): Buffer => {
  let nodes = allocations
    .map(({ account, claimCap, referral, index }) => PublicClaimTree.toNode(index, account, claimCap, referral))
    // sort by lexicographical order
    .sort(Buffer.compare)

  // deduplicate any eleents
  nodes = nodes.filter((el, idx) => {
    return idx === 0 || !nodes[idx - 1].equals(el)
  })

  const layers = []
  layers.push(nodes)

  // Get next layer until we reach the root
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1]))
  }

  return layers[layers.length - 1][0]
}

if (typeof json !== 'object') throw new Error('Invalid JSON')

const merkleRootHex = json.merkleRoot
const merkleRoot = Buffer.from(merkleRootHex.slice(2), 'hex')

let allocations: { index: number, account: string; claimCap: BigInt, referral: string}[] = []
let valid = true

Object.keys(json.claims).forEach((accountReferral) => {
  const claim = json.claims[accountReferral]
  const proof = claim.proof.map((p: string) => Buffer.from(p.slice(2), 'hex'))
  allocations.push({ index: claim.index, account: claim.address,  claimCap: BigInt(claim.claimCap), referral: claim.referral })
  if (verifyProof(claim.index, claim.address, claim.claimCap, claim.referral,  proof, merkleRoot)) {
    console.log('Verified proof for', claim.index, accountReferral)
  } else {
    console.log('Verification for', accountReferral, 'failed')
    valid = false
  }
})

if (!valid) {
  console.error('Failed validation for 1 or more proofs')
  process.exit(1)
}
console.log('Done!')

// Root
const root = getRoot(allocations).toString('hex')
console.log('Reconstructed merkle root', root)
console.log('Root matches the one read from the JSON?', root === merkleRootHex.slice(2))
