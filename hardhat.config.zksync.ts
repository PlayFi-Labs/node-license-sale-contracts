import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "@matterlabs/hardhat-zksync";
import "@matterlabs/hardhat-zksync-node"

dotenv.config();

import "./tasks/verify-playfi-contracts-zksync";

const config: HardhatUserConfig = {
  zksolc: {
    version: "latest",
    compilerSource: "binary",
    settings: {},
  },
  typechain: {
    target: "ethers-v6",
  },
  mocha: {
    timeout: 10000000000,
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 9999,
      },
    },
  },
  networks: {
    hardhat: {
      zksync: true,
      chainId: process.env.FORKING == "true" ? 324 : 31337,
      loggingEnabled: true,
      forking: {
        url:
            "https://zksync-mainnet.g.alchemy.com/v2/" +
            (process.env.ZKSYNC_ALCHEMY_KEY !== undefined ? process.env.ZKSYNC_ALCHEMY_KEY : ""),
        //blockNumber: 'latest',
        enabled: process.env.FORKING !== undefined && process.env.FORKING == "true" ? true : false,
      },
      accounts: {
        count: 300,
      },
    },
    zkSyncTestnet: {
      url: "http://localhost:8011",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      accounts: process.env.SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
    zkSyncSepolia: {
      url: "https://zksync-sepolia.g.alchemy.com/v2/" + (process.env.ZKSYNC_SEPOLIA_ALCHEMY_KEY !== undefined ? process.env.ZKSYNC_SEPOLIA_ALCHEMY_KEY : ""),
      accounts: process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.ZKSYNC_SEPOLIA_PRIVATE_KEY] : [],
      zksync: true,
      ethNetwork: "https://sepolia.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    },
    ethereum: {
      url: "https://mainnet.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      accounts: process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  namedAccounts: {
    deployer: {
      default: 0,
      42161: 0, //TODO: set correct address
      324: 0, //TODO: set correct address
    },
    deployerMultisig: {
      default: 1,
      42161: 1, //TODO: set correct address
      324: 1, //TODO: set correct address
      421614: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785",
      80002: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785",
      300: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785"
    },
    admin: {
      default: 2,
      42161: 2, //TODO: set correct address
      324: 2, //TODO: set correct address
      421614: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      80002: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      300: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b"
    },
    guardian: {
      default: 3,
      42161: 3, //TODO: set correct address
      324: 3, //TODO: set correct address
      421614: 0,
      80002: 0,
      300: 0
    },
    merkleManager: {
      default: 4,
      42161: 4, //TODO: set correct address
      324: 4, //TODO: set correct address
      421614: 0,
      80002: 0,
      300: 0
    },
    referralManager: {
      default: 5,
      42161: 5, //TODO: set correct address
      324: 5, //TODO: set correct address
      421614: 0,
      80002: 0,
      300: 0
    },
    playFiLicenseSaleProxy: {
      300: "0x107f20919a98475AFA234540202c1511ad546c08"
    }
  },
};

export default config;
