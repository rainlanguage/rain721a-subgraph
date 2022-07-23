import { BigInt } from "@graphprotocol/graph-ts";
import { NewChild } from "../generated/Vapour721AFactory/Vapour721AFactory";
import { Vapour721ATemplate } from "../generated/templates";
import { Vapour721A, Vapour721AFactory } from "../generated/schema";

export function handleNewChild(event: NewChild): void {
  let rain721aFactory = Vapour721AFactory.load(event.address.toHex());
  if (!rain721aFactory) {
    rain721aFactory = new Vapour721AFactory(event.address.toHex());
    rain721aFactory.address = event.address;
    rain721aFactory.children = [];
    rain721aFactory.childrenCount = BigInt.fromI32(0);
  }

  let rain721A = new Vapour721A(event.params.child.toHex());
  rain721A.deployer = event.transaction.from;
  rain721A.deployBlockNumber = event.block.number;
  rain721A.deployTimestamp = event.block.number;
  rain721A.nfts = [];

  rain721A.save();
  rain721aFactory.childrenCount = rain721aFactory.childrenCount.plus(
    BigInt.fromI32(1)
  );

  let children = rain721aFactory.children;
  if (children) children.push(rain721A.id);
  rain721aFactory.children = children;

  rain721aFactory.save();
  Vapour721ATemplate.create(event.params.child);
}
