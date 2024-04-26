import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";

import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";

dotenv.config();

import "./tasks/verify-playfi-contracts";

const config: HardhatUserConfig = {
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
      chainId: process.env.FORKING == "true" ? 42161 : 31337,
      forking: {
        url:
            "https://arbitrum-mainnet.infura.io/v3/" +
            (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
        blockNumber: 203592328,
        enabled: process.env.FORKING !== undefined && process.env.FORKING == "true" ? true : false,
      },
      accounts: {
        count: 300,
      },
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.ARBI_SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.ARBI_SEPOLIA_PRIVATE_KEY] : [],
      gas: 210000000,
      gasPrice: 800000000,
    },
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : [],
      gas: 210000000,
      gasPrice: 8000000000,
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      accounts: process.env.SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
      gas: 210000000,
      gasPrice: 800000000,
    },
    ethereum: {
      url: "https://mainnet.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      accounts: process.env.MAINNET_PRIVATE_KEY !== undefined ? [process.env.MAINNET_PRIVATE_KEY] : [],
      gas: 210000000,
      gasPrice: 800000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY !== undefined ? process.env.ETHERSCAN_API_KEY : "",
      sepolia: process.env.ETHERSCAN_API_KEY !== undefined ? process.env.ETHERSCAN_API_KEY : "",
      arbitrumOne: process.env.MAINNET_ARBISCAN_API_KEY !== undefined ? process.env.MAINNET_ARBISCAN_API_KEY : "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY !== undefined ? process.env.ARBISCAN_API_KEY : "",
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      }
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
      42161: 0, //TODO: set correct address
    },
    deployerMultisig: {
      default: 1,
      42161: 1, //TODO: set correct address
      421614: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785"
    },
    admin: {
      default: 2,
      42161: 2, //TODO: set correct address
      421614: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b"
    },
    guardian: {
      default: 3,
      42161: 3, //TODO: set correct address
      421614: 0
    },
    merkleManager: {
      default: 4,
      42161: 4, //TODO: set correct address
      421614: 0
    },
    referralManager: {
      default: 5,
      42161: 5, //TODO: set correct address
      421614: 0
    },
  },
};

export default config;
