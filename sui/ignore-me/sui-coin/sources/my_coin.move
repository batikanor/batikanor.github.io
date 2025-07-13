module my_coin::my_coin {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// The type identifier for the coin. This is a one-time-witness struct.
    struct MY_COIN has drop {}

    /// This function is called once on module publish.
    /// It creates the treasury cap and the coin metadata.
    fun init(witness: MY_COIN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // Decimals
            b"BCN", // Symbol
            b"Batikan's Coin", // Name
            b"A custom coin for Batikan.", // Description
            option::some(sui::url::new_unsafe_from_bytes(b"https://avatars.githubusercontent.com/u/1029224?v=4")), // Icon URL
            ctx
        );
        // Transfer the TreasuryCap to the publisher of the module
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        // Freeze the CoinMetadata object so it cannot be changed
        transfer::public_freeze_object(metadata);
    }

    /// Public function to mint new coins. Can only be called by the owner of the TreasuryCap.
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<MY_COIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);
    }

    /// Public function to burn coins.
    public entry fun burn(treasury_cap: &mut TreasuryCap<MY_COIN>, coin: Coin<MY_COIN>) {
        coin::burn(treasury_cap, coin);
    }
} 
