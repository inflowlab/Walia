#[test_only]
module walia_move::token_tests {
    use sui::test_scenario::{Self as ts, next_tx, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_utils::create_one_time_witness;
    use std::string::{Self, String};
    use walia_move::token::{Self, WaliaToken};

    #[test]
    fun test_token_creation() {
        let user = @0xA;
        let scenario = ts::begin(user);
        
        // First transaction: Create the token
        {
            let ctx = ts::ctx(&mut scenario);
            let name = string::utf8(b"Walia Token");
            let symbol = string::utf8(b"WAL");
            let description = string::utf8(b"Walia Project Token");
            let payment = coin::mint_for_testing<SUI>(1000, ctx);
            
            token::create_token(name, symbol, description, payment, ctx);
        };

        // Second transaction: Verify token properties
        next_tx(&mut scenario, user);
        {
            let token = ts::take_shared<WaliaToken>(&scenario);
            
            assert!(*token::name(&token) == string::utf8(b"Walia Token"), 0);
            assert!(*token::symbol(&token) == string::utf8(b"WAL"), 0);
            assert!(*token::description(&token) == string::utf8(b"Walia Project Token"), 0);
            assert!(token::balance_value(&token) == 1000, 0);
            assert!(token::creator(&token) == user, 0);
            
            ts::return_shared(token);
        };

        ts::end(scenario);
    }
} 