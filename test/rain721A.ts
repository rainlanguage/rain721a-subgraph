import { FetchResult } from "apollo-fetch";
import { constants } from "buffer";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
  ConstructorConfigStruct,
  InitializeConfigStruct,
  OwnershipTransferredEvent,
  Rain721A,
} from "../typechain/Rain721A";
import { NewChildEvent } from "../typechain/Rain721AFactory";
import {
  buyer0,
  buyer1,
  buyer2,
  buyer7,
  config,
  owner,
  rain721aFactory,
  recipient,
  subgraph,
} from "./1_setup";
import {
  arrayify,
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
let vmStateConfig: StateConfig
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

      vmStateConfig = {
        sources: [concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)])],
        constants: [10000, 0],
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
                        vmStateConfig{
                          constants
                          sources
                        }
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

      let sg_stateConfig = rain721AData.vmStateConfig;
      const constants = vmStateConfig.constants.map(ele => ele.toString());
      const sources = vmStateConfig.sources[0];
      
      const sg_constants = sg_stateConfig.constants.map(ele => ele.toString());
      const sg_sources = arrayify(sg_stateConfig.sources[0]);

      expect(constants).to.deep.equals(sg_constants);
      expect(sources).to.deep.equals(sg_sources);
    });
  });

  describe("Owner Test", () => {
    let response: FetchResult;
    before(async () => {
      let ownerTx = await rain721a.connect(owner).transferOwnership(buyer7.address);

      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query:`
        {
          rain721A(id: "${rain721a.address.toLowerCase()}"){
            owner
          }
        }`
      })) as FetchResult;
    });

    it("Should change the owner",async () => {
      let rain721AData = response.data.rain721A;
      expect(rain721AData.owner).to.equals(buyer7.address.toLowerCase());
    });
  });

  describe("Recipient Test", () => {
    let response: FetchResult;
    before(async () => {
      let recipientTx = await rain721a.connect(recipient).setRecipient(buyer7.address);

      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query:`
        {
          rain721A(id: "${rain721a.address.toLowerCase()}"){
            recipient
          }
        }`
      })) as FetchResult;
    });

    it("Should change the recipient",async () => {
      let rain721AData = response.data.rain721A;
      expect(rain721AData.recipient).to.equals(buyer7.address.toLowerCase());
    });
  });

  describe("MintNFT 1 test", () => {
    let nft_response: FetchResult;
    let holder_response: FetchResult;
    before(async () => {
      await rain721a.connect(buyer1).mintNFT(1);

      await waitForSubgraphToBeSynced(1000);

      nft_response = (await subgraph({
        query: `
        {
          nfts{
          id
          tokenId
          owner
          tokenURI
          contract
          }
        }`
      })) as FetchResult;

      holder_response = (await subgraph({
        query: `
        {
         holder(id: "${rain721a.address.toLowerCase()}-${buyer1.address.toLowerCase()}"){
            nfts{
              tokenId
              owner
              tokenURI
              contract
            }
            address
          }
        }`
      })) as FetchResult;

    });
    
    it("Should create NFTs entity correctly",async () => {
      const nfts = nft_response.data.nfts;
      expect(nfts).to.lengthOf(1);
      expect(nfts[0].id).to.deep.include(`1-${rain721a.address.toLowerCase()}`);
      expect(nfts[0].tokenId).to.equals("1");
      expect(nfts[0].owner).to.equals(buyer1.address.toLowerCase());
      expect(nfts[0].tokenURI).to.equals(`baseURI/${nfts[0].tokenId}.json`);
      expect(nfts[0].contract).to.equals(rain721a.address.toLowerCase());
    });

    it("Should create Holder entity correctly",async () => {
      const holder = holder_response.data.holder;
      expect(holder.nfts).to.lengthOf(1);
      expect(holder.address).to.equals(buyer1.address.toLowerCase());
    });
  });

  describe("MintNFT 10 test", () => {
    let nft_response: FetchResult;
    let holder_response: FetchResult;
    before(async () => {
      await rain721a.connect(buyer2).mintNFT(10);

      await waitForSubgraphToBeSynced(1000);

      nft_response = (await subgraph({
        query: `
        {
          nfts{
          id
          tokenId
          owner
          tokenURI
          contract
          }
        }`
      })) as FetchResult;

      holder_response = (await subgraph({
        query: `
        {
         holder(id: "${rain721a.address.toLowerCase()}-${buyer2.address.toLowerCase()}"){
            nfts(orderBy:tokenId){
              tokenId
              owner
              tokenURI
              contract
            }
            address
          }
        }`
      })) as FetchResult;

    });
    
    it("Should create NFTs entity correctly",async () => {
      const nfts = nft_response.data.nfts;
      expect(nfts).to.lengthOf(11);
    });

    it("Should create Holder entity correctly",async () => {
      const holder = holder_response.data.holder;
      expect(holder.nfts).to.lengthOf(10);
      expect(holder.address).to.equals(buyer2.address.toLowerCase());

      const nfts = holder.nfts;

      nfts.forEach((nft, i) => {
        expect(nft.tokenId).to.equals((i + 2).toString());
        expect(nft.owner).to.equals(buyer2.address.toLowerCase());
        expect(nft.tokenURI).to.equals(`baseURI/${nft.tokenId}.json`);
        expect(nft.contract).to.equals(rain721a.address.toLowerCase());
      });
    });
  });
});
