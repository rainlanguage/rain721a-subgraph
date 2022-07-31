import { FetchResult } from "apollo-fetch";
import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import { InitializeConfigStruct, Vapour721A } from "../typechain/Vapour721A";
import { NewChildEvent } from "../typechain/Vapour721AFactory";
import {
  buyer0,
  buyer1,
  buyer2,
  buyer7,
  config,
  owner,
  vapour721AFactory,
  recipient,
  subgraph,
  vapour721AStateBuilder,
  rTKN,
  buyer6,
} from "./1_setup";
import {
  arrayify,
  concat,
  DELEGATED_MINTER,
  getEventArgs,
  op,
  Opcode,
  waitForSubgraphToBeSynced,
  ZERO_ADDRESS,
} from "./utils";

let vapour721A: Vapour721A;
let initializeConfig: InitializeConfigStruct;
let vmStateConfig: StateConfig;
describe("Vapour721A subgraph tests", () => {
  let response;
  let child, sender;
  describe("Should create Factory entity and child entity correctly.", () => {
    before(async () => {
      vmStateConfig = {
        sources: [concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)])],
        constants: [10000, 0],
      };

      initializeConfig = {
        name: "Rain721NFT",
        symbol: "RAIN",
        supplyLimit: 10000,
        baseURI: "baseURI",
        recipient: recipient.address,
        owner: owner.address,
        royaltyBPS: 1000,
        admin: buyer6.address,
        currency: ZERO_ADDRESS,
        vmStateConfig: vmStateConfig
      };


      const deployTx = await vapour721AFactory
        .connect(buyer0)
        .createChildTyped(initializeConfig);

      [sender, child] = (await getEventArgs(
        deployTx,
        "NewChild",
        vapour721AFactory
      )) as NewChildEvent["args"];

      vapour721A = (await ethers.getContractAt(
        "Vapour721A",
        child
      )) as Vapour721A;

      await vapour721A.connect(buyer6).grantRole(DELEGATED_MINTER, buyer2.address);
      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query: `
            {
              vapour721AFactory(id: "${config.vapour721AFactory.toLowerCase()}"){
                    address
                    children{
                    id
                    }
                    childrenCount
                    implementation
                }
            }`,
      })) as FetchResult;
    });

    it("Should create Factory entity correctly", async () => {
      const factory = response.data.vapour721AFactory;
      expect(factory.address).to.equals(config.vapour721AFactory.toLowerCase());
      expect(factory.children).to.lengthOf(1);
      expect(factory.children).to.deep.include({
        id: vapour721A.address.toLowerCase(),
      });
      expect(factory.childrenCount).to.equals("1");
      expect(factory.implementation).to.not.null;
    });

    it("Should create Vapour721A entity correctly", async () => {
      response = (await subgraph({
        query: `
                {
                  vapour721A(id: "${vapour721A.address.toLowerCase()}"){
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
                        currency{
                          id
                        }
                    }
                }`,
      })) as FetchResult;

      const vapour721AData = response.data.vapour721A;

      expect(vapour721AData.id).to.equals(vapour721A.address.toLowerCase());
      expect(vapour721AData.name).to.equals(initializeConfig.name);
      expect(vapour721AData.symbol).to.equals(initializeConfig.symbol);
      expect(vapour721AData.supplyLimit).to.equals(
        initializeConfig.supplyLimit.toString()
      );
      expect(vapour721AData.baseURI).to.equals(initializeConfig.baseURI);
      expect(vapour721AData.owner).to.equals(
        initializeConfig.owner.toLowerCase()
      );
      expect(vapour721AData.recipient).to.equals(
        initializeConfig.recipient.toLowerCase()
      );
      expect(vapour721AData.deployer).to.equals(buyer0.address.toLowerCase());
      expect(vapour721AData.vmStateBuilder).to.equals(
        vapour721AStateBuilder.address.toLowerCase()
      );

      expect(vapour721AData.currency.id).to.equals(ZERO_ADDRESS);

      let sg_stateConfig = vapour721AData.vmStateConfig;
      const constants = vmStateConfig.constants.map((ele) => ele.toString());
      const sources = vmStateConfig.sources[0];

      const sg_constants = sg_stateConfig.constants.map((ele) =>
        ele.toString()
      );
      const sg_sources = arrayify(sg_stateConfig.sources[0]);

      expect(constants).to.deep.equals(sg_constants);
      expect(sources).to.deep.equals(sg_sources);
    });

    describe("Should create token entity correctly", () => {
      it("Native Token test", async () => {
        response = (await subgraph({query:`{
          token(id: "${ZERO_ADDRESS}"){
            name
            symbol
            decimals
            totalSupply
          }
        }`}))

        const token = response.data.token;
        expect(token.name).to.equals("Matic Token");
        expect(token.symbol).to.equals("MATIC");
        expect(token.decimals).to.equals(18);
        expect(token.totalSupply).to.equals("0");
      });
    });
  });

  describe("Owner Test", () => {
    let response: FetchResult;
    before(async () => {
      let ownerTx = await vapour721A
        .connect(owner)
        .transferOwnership(buyer7.address);

      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query: `
        {
          vapour721A(id: "${vapour721A.address.toLowerCase()}"){
            owner
          }
        }`,
      })) as FetchResult;
    });

    it("Should change the owner", async () => {
      let vapour721AData = response.data.vapour721A;
      expect(vapour721AData.owner).to.equals(buyer7.address.toLowerCase());
    });
  });

  describe("Recipient Test", () => {
    let response: FetchResult;
    before(async () => {
      let recipientTx = await vapour721A
        .connect(recipient)
        .setRecipient(buyer7.address);

      await waitForSubgraphToBeSynced(1000);

      response = (await subgraph({
        query: `
        {
          vapour721A(id: "${vapour721A.address.toLowerCase()}"){
            recipient
          }
        }`,
      })) as FetchResult;
    });

    it("Should change the recipient", async () => {
      let vapour721AData = response.data.vapour721A;
      expect(vapour721AData.recipient).to.equals(buyer7.address.toLowerCase());
    });
  });

  describe("MintNFT 1 test", () => {
    let nft_response: FetchResult;
    let holder_response: FetchResult;
    before(async () => {
      await vapour721A.connect(buyer1).mintNFT({
        minimumUnits: 1,
        maximumPrice: 0,
        desiredUnits: 1,
      });

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
        }`,
      })) as FetchResult;

      holder_response = (await subgraph({
        query: `
        {
         holder(id: "${vapour721A.address.toLowerCase()}-${buyer1.address.toLowerCase()}"){
            nfts{
              tokenId
              owner
              tokenURI
              contract
            }
            address
          }
        }`,
      })) as FetchResult;
    });

    it("Should create NFTs entity correctly", async () => {
      const nfts = nft_response.data.nfts;
      expect(nfts).to.lengthOf(1);
      expect(nfts[0].id).to.deep.include(
        `1-${vapour721A.address.toLowerCase()}`
      );
      expect(nfts[0].tokenId).to.equals("1");
      expect(nfts[0].owner).to.equals(buyer1.address.toLowerCase());
      expect(nfts[0].tokenURI).to.equals(`baseURI/${nfts[0].tokenId}.json`);
      expect(nfts[0].contract).to.equals(vapour721A.address.toLowerCase());
    });

    it("Should create Holder entity correctly", async () => {
      const holder = holder_response.data.holder;
      expect(holder.nfts).to.lengthOf(1);
      expect(holder.address).to.equals(buyer1.address.toLowerCase());
    });
  });

  describe("MintNFT 10 test", () => {
    let nft_response: FetchResult;
    let holder_response: FetchResult;
    before(async () => {
      await vapour721A.connect(buyer2).mintNFT({
        minimumUnits: 1,
        maximumPrice: 0,
        desiredUnits: 10,
      });

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
        }`,
      })) as FetchResult;

      holder_response = (await subgraph({
        query: `
        {
         holder(id: "${vapour721A.address.toLowerCase()}-${buyer2.address.toLowerCase()}"){
            nfts(orderBy:tokenId){
              tokenId
              owner
              tokenURI
              contract
            }
            address
          }
        }`,
      })) as FetchResult;
    });

    it("Should create NFTs entity correctly", async () => {
      const nfts = nft_response.data.nfts;
      expect(nfts).to.lengthOf(11);
    });

    it("Should create Holder entity correctly", async () => {
      const holder = holder_response.data.holder;
      expect(holder.nfts).to.lengthOf(10);
      expect(holder.address).to.equals(buyer2.address.toLowerCase());

      const nfts = holder.nfts;

      nfts.forEach((nft, i) => {
        expect(nft.tokenId).to.equals((i + 2).toString());
        expect(nft.owner).to.equals(buyer2.address.toLowerCase());
        expect(nft.tokenURI).to.equals(`baseURI/${nft.tokenId}.json`);
        expect(nft.contract).to.equals(vapour721A.address.toLowerCase());
      });
    });
  });

});

describe("ERC20 Token test", () => {
  let erc20vapour721A: Vapour721A;
  before(async () => {
    let ERC20constructorConfig: InitializeConfigStruct = {
      name: "Rain721NFT",
      symbol: "RAIN",
      supplyLimit: 10000,
      baseURI: "baseURI",
      recipient: recipient.address,
      owner: owner.address,
      royaltyBPS: 1000,
      admin: buyer2.address,
      currency: rTKN.address,
      vmStateConfig: vmStateConfig
    };

    await rTKN.connect(buyer0).mintTokens(1000);
    const deployTx = await vapour721AFactory
      .connect(buyer0)
      .createChildTyped(ERC20constructorConfig);

    let [sender, child] = (await getEventArgs(
      deployTx,
      "NewChild",
      vapour721AFactory
    )) as NewChildEvent["args"];

    erc20vapour721A = (await ethers.getContractAt(
      "Vapour721A",
      child
    )) as Vapour721A;
  });

  it("Should create correct erc20 token",async () => {
    await waitForSubgraphToBeSynced(1000);
    const response = (await subgraph({query:
    `{
      token(id: "${rTKN.address.toLowerCase()}"){
        id
        name
        symbol
        decimals
        totalSupply
      }
      vapour721A(id: "${erc20vapour721A.address.toLowerCase()}"){
        currency{
          id
        }
      }
    }`})) as FetchResult;

    let token = response.data.token;
    let currency = response.data.vapour721A.currency;
    expect(token.id).to.equals(rTKN.address.toLowerCase());
    expect(token.name).to.equals(await rTKN.name());
    expect(token.symbol).to.equals(await rTKN.symbol());
    expect(token.decimals).to.equals(await rTKN.decimals());
    expect(token.totalSupply).to.equals(await rTKN.totalSupply());

    expect(currency.id).to.equals(rTKN.address.toLowerCase());
  });
});
