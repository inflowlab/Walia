module walia_move::token {
    use std::string;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};

    /// A custom token for the Walia project
    struct WaliaToken has key, store {
        id: UID,
        name: string::String,
        symbol: string::String,
        description: string::String,
        balance: Balance<SUI>,
        creator: address
    }

    /// Create a new WaliaToken
    public fun create_token(
        name: string::String,
        symbol: string::String,
        description: string::String,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let balance = coin::into_balance(payment);
        
        let token = WaliaToken {
            id: object::new(ctx),
            name,
            symbol,
            description,
            balance,
            creator: tx_context::sender(ctx)
        };

        transfer::share_object(token);
    }

    /// Get the token's name
    public fun name(token: &WaliaToken): &string::String {
        &token.name
    }

    /// Get the token's symbol
    public fun symbol(token: &WaliaToken): &string::String {
        &token.symbol
    }

    /// Get the token's description
    public fun description(token: &WaliaToken): &string::String {
        &token.description
    }

    /// Get the token's balance
    public fun balance_value(token: &WaliaToken): u64 {
        balance::value(&token.balance)
    }

    /// Get the token's creator
    public fun creator(token: &WaliaToken): address {
        token.creator
    }
} 