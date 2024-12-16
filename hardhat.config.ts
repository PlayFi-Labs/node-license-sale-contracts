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
      chainId: process.env.FORKING == "true" ? 1 : 31337,
      forking: {
        url:
            "https://mainnet.infura.io/v3/" +
            (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
        blockNumber: 20776237,
        enabled: process.env.FORKING !== undefined && process.env.FORKING == "true" ? true : false,
      },
      accounts: {
        count: 300,
      },
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.ARBI_SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.ARBI_SEPOLIA_PRIVATE_KEY] : [],
    },
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: process.env.ARBI_PRIVATE_KEY !== undefined ? [process.env.ARBI_PRIVATE_KEY] : [],
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : ""),
      accounts: process.env.SEPOLIA_PRIVATE_KEY !== undefined ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
    polygonAmoy: {
      url: "https://polygon-amoy.g.alchemy.com/v2/" + (process.env.AMOY_ALCHEMY_KEY !== undefined ? process.env.AMOY_ALCHEMY_KEY : ""),
      accounts: process.env.AMOY_PRIVATE_KEY !== undefined ? [process.env.AMOY_PRIVATE_KEY] : [],
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
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY !== undefined ? process.env.ETHERSCAN_API_KEY : "",
      sepolia: process.env.ETHERSCAN_API_KEY !== undefined ? process.env.ETHERSCAN_API_KEY : "",
      arbitrumOne: process.env.ARBISCAN_API_KEY !== undefined ? process.env.ARBISCAN_API_KEY : "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY !== undefined ? process.env.ARBISCAN_API_KEY : "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY !== undefined ? process.env.POLYGONSCAN_API_KEY : "",
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/",
        },
      }
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
      42161: "0x06975E4EFdA114EBFe39c85EcC4AC2FcdaC3934B",
    },
    deployerMultisig: {
      default: 1,
      42161: "0x3a69E75706185E6f931005B47e6A6bc516caeECD",
      421614: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785",
      80002: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785",
      11155111: "0x571E443ccd1A35fEb3AfCD9F4a72f589Ef7eA785",
      1: "0xe99935A87053E92101866a460601Be2b019BA35C"
    },
    admin: {
      default: 2,
      42161: "0x3a69E75706185E6f931005B47e6A6bc516caeECD",
      421614: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      80002: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      11155111: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      1: "0xaBdE4306c91591Fc9E3140040Ca4b265fAAD51F5"
    },
    guardian: {
      default: 3,
      42161: "0x4dE2c8986C03A8F9F10B5956606Fd74F5a0626BD",
      421614: 0,
      80002: 0
    },
    merkleManager: {
      default: 4,
      42161: "0x37f367bebd31A77eF65B6387B3E6086c3869c2e3",
      421614: 0,
      80002: 0,
      11155111: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b",
      1: "0x37f367bebd31A77eF65B6387B3E6086c3869c2e3"
    },
    referralManager: {
      default: 5,
      42161: "0x37f367bebd31A77eF65B6387B3E6086c3869c2e3",
      421614: 0,
      80002: 0
    },
    executor: {
      42161: "0xB14956f655256E9cd79A84d10302df21472e2a88",
      421614: "0xf558c6EECcf47ce88E644Ce48DD6ca9176e2C23b"
    },
    playFiLicenseSaleProxy: {
      42161: "0x66F49158826a5A3953636ff63350bA815C9665AD",
      421614: "0x7e63815F59228a23fd89bcf0Aa903C3835E2604b"
    }
  },
};

export default config;
