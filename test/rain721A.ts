import { FetchResult } from "apollo-fetch";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
  ConstructorConfigStruct,
  InitializeConfigStruct,
  Rain721A,
} from "../typechain/Rain721A";
import { NewChildEvent } from "../typechain/Rain721AFactory";
import {
  buyer0,
  config,
  owner,
  rain721aFactory,
  recipient,
  subgraph,
} from "./1_setup";
import {
  concat,
  eighteenZeros,
  getEventArgs,
  op,
  Opcode,
  waitForSubgraphToBeSynced,
  ZERO_ADDRESS,
} from "./utils";

let rain721a: Rain721A;
let constructorConfig: ConstructorConfigStruct;
let initializeConfig: InitializeConfigStruct;
describe("Rain721A subgraph tests", () => {
  let response;
  let child, sender;
  describe("Should create Factory entity and child entity correctly.", () => {
    before(async () => {
      constructorConfig = {
        name: "Rain721NFT",
        symbol: "RAIN",
        supplyLimit: 10000,
        baseURI: "baseURI",
        recipient: recipient.address,
        owner: owner.address,
      };

      let vmStateConfig: StateConfig = {
        sources: [concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)])],
        constants: [10000, BigNumber.from(1 + eighteenZeros)],
      };

      initializeConfig = {
        vmStateBuilder: config.rain721AStateBuilder,
        currency: ZERO_ADDRESS,
        vmStateConfig: vmStateConfig,
      };
      const deployTx = await rain721aFactory.connect(buyer0).createChildTyped(
        constructorConfig,
        initializeConfig
      );

      [sender, child] = (await getEventArgs(
        deployTx,
        "NewChild",
        rain721aFactory
      )) as NewChildEvent["args"];

      rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query: `
            {
                rain721AFactory(id: "${config.rain721aFactory.toLowerCase()}"){
                    address
                    children{
                    id
                    }
                    childrenCount
                }
            }`,
      })) as FetchResult;
    });

    it("Should create Factory entity correctly", async () => {
      const factory = response.data.rain721AFactory;
      expect(factory.address).to.equals(config.rain721aFactory.toLowerCase());
      expect(factory.children).to.lengthOf(1);
      expect(factory.children).to.deep.include({id:rain721a.address.toLowerCase()});
      expect(factory.childrenCount).to.equals("1");
    });

    it("Should create Rain721A entity correctly", async () => {
      response = (await subgraph({
        query: `
                {
                    rain721A(id: "${rain721a.address.toLowerCase()}"){
                        id
                        name
                        symbol
                        supplyLimit
                        vmStateConfig
                        vmStateBuilder
                        deployer
                        owner
                        recipient
                        baseURI
                    }
                }`,
      })) as FetchResult;

      const rain721AData = response.data.rain721A;

      expect(rain721AData.id).to.equals(rain721a.address.toLowerCase());
      expect(rain721AData.name).to.equals(constructorConfig.name);
      expect(rain721AData.symbol).to.equals(constructorConfig.symbol);
      expect(rain721AData.supplyLimit).to.equals(
        constructorConfig.supplyLimit.toString()
      );
      expect(rain721AData.baseURI).to.equals(constructorConfig.baseURI);
      expect(rain721AData.owner).to.equals(
        constructorConfig.owner.toLowerCase()
      );
      expect(rain721AData.recipient).to.equals(
        constructorConfig.recipient.toLowerCase()
      );
      expect(rain721AData.deployer).to.equals(buyer0.address.toLowerCase());
      expect(rain721AData.vmStateBuilder).to.equals(
        initializeConfig.vmStateBuilder.toLowerCase()
      );
    });
  });
});
