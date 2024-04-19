import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";

import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";

dotenv.config();

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
      chainId: process.env.FORKING == "true" ? 1261120 : 31337,
      forking: {
        url:
            "https://rpc.startale.com/zkatana" /*+
          (process.env.INFURA_KEY !== undefined ? process.env.INFURA_KEY : "")*/,
        blockNumber: 547415,
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
      42161: 0,
    },
  },
};

export default config;
