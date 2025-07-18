module my_nft::my_nft {
    use sui::url::{Self, Url};
    use std::string::String;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// The NFT object.
    struct AwesomeNFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: Url,
    }

    /// Public method to mint an NFT.
    /// It takes a name, description, and url, and transfers the NFT to the sender.
    public entry fun mint(
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        ctx: &mut TxContext
    ) {
        let nft = AwesomeNFT {
            id: object::new(ctx),
            name: std::string::utf8(name),
            description: std::string::utf8(description),
            url: url::new_unsafe_from_bytes(url),
        };
        transfer::public_transfer(nft, tx_context::sender(ctx));
    }
} 
