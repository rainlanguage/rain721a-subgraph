import { ERC20 } from "../generated/templates/Vapour721ATemplate/ERC20";
import {
  Holder,
  NFT,
  Vapour721A,
  StateConfig,
  Token,
} from "../generated/schema";
import {
  Construct,
  Initialize,
  OwnershipTransferred,
  RecipientChanged,
  Transfer,
} from "../generated/templates/Vapour721ATemplate/Vapour721A";

import { ZERO, ZERO_ADDRESS } from "./utils";
export function handleConstruct(event: Construct): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    vapour721A.name = event.params.config_.name;
    vapour721A.symbol = event.params.config_.symbol;
    vapour721A.baseURI = event.params.config_.baseURI;
    vapour721A.owner = event.params.config_.owner;
    vapour721A.recipient = event.params.config_.recipient;
    vapour721A.supplyLimit = event.params.config_.supplyLimit;
    vapour721A.royaltyBPS = event.params.config_.royaltyBPS;
    vapour721A.save();
  }
}

export function handleInitialize(event: Initialize): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    let vmStateConfig = new StateConfig(event.address.toHex());
    vmStateConfig.sources = event.params.config_.vmStateConfig.sources;
    vmStateConfig.constants = event.params.config_.vmStateConfig.constants;

    vmStateConfig.save();
    vapour721A.vmStateConfig = vmStateConfig.id;

    vapour721A.vmStateBuilder = event.params.config_.vmStateBuilder;
    if (event.params.config_.currency.toHex() == ZERO_ADDRESS) {
      let currency = Token.load(event.params.config_.currency.toHex());
      if (!currency) {
        currency = new Token(event.params.config_.currency.toHex());
        currency.name = "Matic Token";
        currency.symbol = "MATIC";
        currency.decimals = 18;
        currency.totalSupply = ZERO;
        currency.save();
      }
      vapour721A.currency = currency.id;
    } else {
      let currency = Token.load(event.params.config_.currency.toHex());
      let tokenContract = ERC20.bind(event.params.config_.currency);
      if (!currency) {
        currency = new Token(event.params.config_.currency.toHex());
        let name = tokenContract.try_name();
        let symbol = tokenContract.try_symbol();
        let decimals = tokenContract.try_decimals();
        currency.name = !name.reverted ? name.value : "ERROR";
        currency.symbol = !symbol.reverted ? symbol.value : "ERROR";
        currency.decimals = !decimals.reverted ? decimals.value : 0;
      }
      let totalSupply = tokenContract.try_totalSupply();
      currency.totalSupply = !totalSupply.reverted ? totalSupply.value : ZERO;
      currency.save();

      vapour721A.currency = currency.id;
    }
    vapour721A.save();
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    vapour721A.owner = event.params.newOwner;
    vapour721A.save();
  }
}

export function handleRecipientChanged(event: RecipientChanged): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    vapour721A.recipient = event.params.newRecipient;
    vapour721A.save();
  }
}

export function handleTransfer(event: Transfer): void {
  let rain721a = Vapour721A.load(event.address.toHex());
  if (rain721a) {
    let receiver = Holder.load(
      [event.address.toHex(), event.params.to.toHex()].join("-")
    );
    if (!receiver) {
      receiver = new Holder(
        [event.address.toHex(), event.params.to.toHex()].join("-")
      );
      receiver.address = event.params.to;
      receiver.nfts = [];
    }
    let nft = NFT.load(
      [event.params.tokenId.toString(), event.address.toHex()].join("-")
    );
    if (!nft) {
      nft = new NFT(
        [event.params.tokenId.toString(), event.address.toHex()].join("-")
      );
      nft.tokenId = event.params.tokenId;
      nft.tokenURI =
        rain721a.baseURI + "/" + event.params.tokenId.toString() + ".json";
      nft.contract = event.address;

      let nfts = rain721a.nfts;
      if (nfts) nfts.push(nft.id);
      rain721a.nfts = nfts;

      rain721a.save();
    }
    if (receiver) {
      nft.owner = receiver.address;
      nft.save();

      let nfts = receiver.nfts;
      if (nfts) nfts.push(nft.id);
      receiver.nfts = nfts;
      receiver.save();
    }
  }

  if (event.params.from.toHex() != ZERO_ADDRESS) {
    let sender = Holder.load(
      [event.address.toHex(), event.params.from.toHex()].join("-")
    );
    if (sender) {
      let nfts = sender.nfts;
      let new_nfts: string[] = [];
      if (nfts) {
        for (let i = 0; i < nfts.length; i++) {
          if (
            nfts[i] !=
            [event.params.tokenId.toString(), event.address.toHex()].join("-")
          )
            new_nfts.push(nfts[i]);
        }
      }
      sender.nfts = new_nfts;
      sender.save();
    }
  }
}
