import { Holder, NFT, Rain721A, StateConfig } from "../generated/schema";
import {
  Construct,
  Initialize,
  OwnershipTransferred,
  RecipientChanged,
  Transfer,
} from "../generated/templates/Rain721ATemplate/Rain721A";
import { ZERO_ADDRESS } from "./utils";
export function handleConstruct(event: Construct): void {
  let rain721A = Rain721A.load(event.address.toHex());
  if (rain721A) {
    rain721A.name = event.params.config_.name;
    rain721A.symbol = event.params.config_.symbol;
    rain721A.baseURI = event.params.config_.baseURI;
    rain721A.owner = event.params.config_.owner;
    rain721A.recipient = event.params.config_.recipient;
    rain721A.supplyLimit = event.params.config_.supplyLimit;
    rain721A.save();
  }
}

export function handleInitialize(event: Initialize): void {
  let rain721A = Rain721A.load(event.address.toHex());
  if (rain721A) {
    let vmStateConfig = new StateConfig(event.address.toHex());
    vmStateConfig.sources = event.params.config_.vmStateConfig.sources;
    vmStateConfig.constants = event.params.config_.vmStateConfig.constants;

    vmStateConfig.save();
    rain721A.vmStateConfig = vmStateConfig.id;

    rain721A.vmStateBuilder = event.params.config_.vmStateBuilder;
    rain721A.save();
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let rain721A = Rain721A.load(event.address.toHex());
  if (rain721A) {
    rain721A.owner = event.params.newOwner;
    rain721A.save();
  }
}

export function handleRecipientChanged(event: RecipientChanged): void {
  let rain721A = Rain721A.load(event.address.toHex());
  if (rain721A) {
    rain721A.recipient = event.params.newRecipient;
    rain721A.save();
  }
}

export function handleTransfer(event: Transfer): void {
  let rain721a = Rain721A.load(event.address.toHex());
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
      nft.tokenURI = rain721a.baseURI + "/" + event.params.tokenId.toString() + ".json";
      nft.contract = event.address;
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
    if(sender){
      let nfts = sender.nfts;
      let new_nfts: string[] = [];
      if (nfts) {
        for (let i = 0; i < nfts.length; i++) {
          if (nfts[i] != [event.params.tokenId.toString(), event.address.toHex()].join("-")) new_nfts.push(nfts[i]);
        }
      }
      sender.nfts = new_nfts;
      sender.save();
    }
  }
}
