import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import path from "path";
import {
  InitializeConfigStruct,
  Vapour721A,
} from "../typechain/Vapour721A";
import { ApolloFetch} from "apollo-fetch";
import { Vapour721AFactory } from "../typechain/Vapour721AFactory";
import { Token } from "../typechain/Token";
import { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155";
import { delay, exec, fetchFile, fetchSubgraph, writeFile } from "./utils";
import { exit } from "process";

export let vapour721AFactory: Vapour721AFactory;
export let rain721a: Vapour721A;
export let rain721aInitializeConfig: InitializeConfigStruct;
export let rTKN: Token;
export let gameAsset: ReserveTokenERC1155;
export let recipient: SignerWithAddress,
  owner: SignerWithAddress,
  buyer0: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  buyer3: SignerWithAddress,
  buyer4: SignerWithAddress,
  buyer5: SignerWithAddress,
  buyer6: SignerWithAddress,
  buyer7: SignerWithAddress;

export let subgraph: ApolloFetch
export let config;
const subgraphName = "beehive-innovation/rain-protocol";

before(async () => {
  console.log("Setting up environment for Vapour721A test");

  const signers = await ethers.getSigners();
  recipient = signers[0];
  owner = signers[1];
  buyer0 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  buyer3 = signers[5];
  buyer4 = signers[6];
  buyer5 = signers[7];
  buyer6 = signers[8];
  buyer7 = signers[9];

  const Vapour721AStateBuilder = await ethers.getContractFactory(
    "Vapour721AStateBuilder"
  );

  const Vapour721AFactory = await ethers.getContractFactory("Vapour721AFactory");
  vapour721AFactory = (await Vapour721AFactory.deploy()) as Vapour721AFactory;
  await vapour721AFactory.deployed();


  const Erc20 = await ethers.getContractFactory("Token");

  rTKN = (await Erc20.deploy("Rain Token", "rTKN")) as Token;
  await rTKN.deployed();

  const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");

  gameAsset = (await Erc1155.deploy()) as ReserveTokenERC1155;
  await gameAsset.deployed();

  const pathExampleConfig = path.resolve(
    __dirname,
    `../config/test/${hre.network.name}.json`
  );
  config = JSON.parse(fetchFile(pathExampleConfig));

  config.network = hre.network.name;

  config.vapour721AFactory = vapour721AFactory.address;
  config.vapour721AFactoryBlock = vapour721AFactory.deployTransaction.blockNumber;

  const pathConfigLocal = path.resolve(
    __dirname,
    `../config/test/${hre.network.name}.json`
  );
  writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  try {
    exec(`npm run deploy:localhost`);
  } catch (error) {
    console.log(`Subgraph deployment failed : ${error}`);
    exit(0);
  }

  subgraph = fetchSubgraph(subgraphName);
  await delay(1000)
});
