import { BigInt } from "@graphprotocol/graph-ts";
import { NewChild } from "../generated/Vapour721AFactory/Vapour721AFactory";
import { Vapour721ATemplate } from "../generated/templates";
import { Vapour721A, Vapour721AFactory } from "../generated/schema";
import { ZERO } from "./utils";

export function handleNewChild(event: NewChild): void {
  let vapour721AFactory = Vapour721AFactory.load(event.address.toHex());
  if (!vapour721AFactory) {
    vapour721AFactory = new Vapour721AFactory(event.address.toHex());
    vapour721AFactory.address = event.address;
    vapour721AFactory.children = [];
    vapour721AFactory.childrenCount = BigInt.fromI32(0);
  }

  let vapour721A = new Vapour721A(event.params.child.toHex());
  vapour721A.deployer = event.transaction.from;
  vapour721A.deployBlockNumber = event.block.number;
  vapour721A.deployTimestamp = event.block.number;
  vapour721A.nfts = [];
  vapour721A.withdrawals = [];
  vapour721A.mintTransactions = [];
  vapour721A.amountPayable = ZERO;
  vapour721A.amountWithdrawn = ZERO;
  vapour721A.mintTransactionCount = ZERO;

  vapour721A.save();
  vapour721AFactory.childrenCount = vapour721AFactory.childrenCount.plus(
    BigInt.fromI32(1)
  );

  let children = vapour721AFactory.children;
  if (children) children.push(vapour721A.id);
  vapour721AFactory.children = children;

  vapour721AFactory.save();
  Vapour721ATemplate.create(event.params.child);
}
