import { ERC20 } from "../generated/templates/Vapour721ATemplate/ERC20";
import {
  Holder,
  NFT,
  Vapour721A,
  StateConfig,
  Token,
  Withdraw,
  MintTransaction,
  Role,
  RoleHolder,
  RoleGranted,
  RoleRevoked,
} from "../generated/schema";
import {
  Initialize,
  OwnershipTransferred,
  RecipientChanged,
  Transfer,
  Withdraw as WithdrawEvent,
  Buy,
  RoleAdminChanged,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
} from "../generated/templates/Vapour721ATemplate/Vapour721A";

import {
  DELEGATED_MINTER,
  DELEGATED_MINTER_ADMIN,
  ONE,
  ZERO,
  ZERO_ADDRESS,
} from "./utils";
import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

export function handleInitialize(event: Initialize): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    let vmStateConfig = new StateConfig(event.address.toHex());
    vmStateConfig.sources = event.params.config_.vmStateConfig.sources;
    vmStateConfig.constants = event.params.config_.vmStateConfig.constants;

    vmStateConfig.save();
    vapour721A.vmStateConfig = vmStateConfig.id;

    vapour721A.vmStateBuilder = event.params.vmStateBuilder_;
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
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
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
        vapour721A.baseURI + "/" + event.params.tokenId.toString() + ".json";
      nft.contract = event.address;

      let nfts = vapour721A.nfts;
      if (nfts) nfts.push(nft.id);
      vapour721A.nfts = nfts;

      vapour721A.save();
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

export function handleWithdraw(event: WithdrawEvent): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    vapour721A.amountWithdrawn = event.params._totalWithdrawn;
    vapour721A.amountPayable = ZERO;

    let withdraw = new Withdraw(event.transaction.hash.toString());
    withdraw.amount = event.params._amountWithdrawn;
    withdraw.timeStamp = event.block.timestamp;
    withdraw.withdrawer = event.params._withdrawer;
    withdraw.save();

    let withdrawals = vapour721A.withdrawals;
    if (withdrawals) withdrawals.push(withdraw.id);
    vapour721A.withdrawals = withdrawals;

    vapour721A.save();
  }
}

export function handleBuy(event: Buy): void {
  let vapour721A = Vapour721A.load(event.address.toHex());
  if (vapour721A) {
    vapour721A.amountPayable = vapour721A.amountPayable.plus(
      event.params._cost
    );

    let transaction = new MintTransaction(
      vapour721A.mintTransactionCount.toString()
    );
    transaction.mintBlockNumber = event.block.number;
    transaction.mintTimestamp = event.block.timestamp;
    transaction.hash = event.transaction.hash.toHex();
    transaction.cost = event.params._cost;
    transaction.receiver = event.params._receiver;
    transaction.units = event.params._units;
    transaction.nfts = [];

    let T_nfts = transaction.nfts;
    let V_nfts = vapour721A.nfts;
    let length = V_nfts ? BigInt.fromI32(V_nfts.length) : ZERO;
    let startIndex = length.minus(event.params._units); // cause nfts are already minted

    for (; startIndex < length; startIndex = startIndex.plus(ONE)) {
      if (T_nfts && V_nfts) T_nfts.push(V_nfts[startIndex.toI32()]);
    }
    transaction.nfts = T_nfts;
    transaction.save();

    let mintTransactions = vapour721A.mintTransactions;
    if (mintTransactions) mintTransactions.push(transaction.id);
    vapour721A.mintTransactions = mintTransactions;

    vapour721A.mintTransactionCount = vapour721A.mintTransactionCount.plus(ONE);
    vapour721A.save();
  }
}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {
  let role = new Role(event.params.role.toHex());
  role.contract = event.address;
  role.roleHash = event.params.role;
  role.roleName = getRoleName(event.params.role);
  role.roleHolders = [];
  role.save();
}

export function handleRoleGranted(event: RoleGrantedEvent): void {
  let roleHolder = RoleHolder.load(
    event.address.toHex() + "-" + event.params.account.toHex()
  );
  let role = getRole(event.params.role, event.address);
  
  if (!roleHolder) {
    roleHolder = new RoleHolder(
      event.address.toHex() + "-" + event.params.account.toHex()
    );
    roleHolder.contract = event.address;
    roleHolder.account = event.params.account;
    if (role) roleHolder.role = role.id;
    roleHolder.hasRole = true;
    roleHolder.roleGrants = [];
    roleHolder.roleRevoked = [];
  }
  if (roleHolder) {
    let roleGranted = new RoleGranted(event.transaction.hash.toHex());
    roleGranted.account = event.params.account;
    roleGranted.sender = event.params.sender;
    roleGranted.role = event.params.role.toHex();
    roleGranted.emitter = event.params.sender;
    roleGranted.contract = event.address;
    roleGranted.transaction = event.transaction.hash.toHex();
    roleGranted.timestamp = event.block.timestamp;
    roleGranted.roleHolder = roleHolder.id;

    roleGranted.save();
    let roleGrants = roleHolder.roleGrants;
    if (roleGrants) roleGrants.push(roleGranted.id);
    roleHolder.roleGrants = roleGrants;
    roleHolder.save();
  }
  if (role) {
    let roleHolders = role.roleHolders;
    if (roleHolders) roleHolders.push(roleHolder.id);
    role.roleHolders = roleHolders;
    role.save();
  }
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  let roleHolder = RoleHolder.load(
    event.address.toHex() + "-" + event.params.account.toHex()
  );

  let role = getRole(event.params.role, event.address);

  if (roleHolder) {
    let roleRevoked = new RoleRevoked(event.transaction.hash.toHex());
    roleRevoked.transaction = event.transaction.hash.toHex();
    roleRevoked.timestamp = event.block.timestamp;
    roleRevoked.sender = event.params.sender;
    roleRevoked.account = event.params.account;
    roleRevoked.emitter = event.params.sender;
    roleRevoked.contract = event.address;
    if (role) roleRevoked.role = role.id;
    roleRevoked.roleHolder = roleHolder.id;
    roleRevoked.save();
    
    let rRoleRevoked = roleHolder.roleRevoked;
    if (rRoleRevoked) rRoleRevoked.push(roleRevoked.id);
    roleHolder.roleRevoked = rRoleRevoked;
    roleHolder.save();
  }
  if (role) {
    let roleHolders = role.roleHolders;
    if (roleHolders && roleHolder) roleHolders.push(roleHolder.id);
    role.roleHolders = roleHolders;
    role.save();
  }
}

function getRoleName(role: Bytes): string {
  if (role.toHex() == DELEGATED_MINTER.toString()) {
    return "DELEGATED_MINTER";
  }
  if (role.toHex() == DELEGATED_MINTER_ADMIN.toString()) {
    return "DELEGATED_MINTER_ADMIN";
  }
  return "NONE";
}

function getRole(roleHash: Bytes, contract: Bytes): Role{
  let role = Role.load(roleHash.toHex());
  if(!role){
    role = new Role(roleHash.toHex());
    role.contract = contract;
    role.roleHash = roleHash;
    role.roleName = getRoleName(roleHash);
    role.roleHolders = [];
    role.save();
  }
  return role;
}