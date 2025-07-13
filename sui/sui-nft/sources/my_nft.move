module my_nft::my_nft {
    use sui::url::{Self, Url};
    use std::string::String;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event::{Self, Event};
    use sui::object::ID;

    /// The NFT object.
    struct AwesomeNFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: Url,
    }

    struct MintEvent has copy, drop {
        nft_id: ID,
        name: String,
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
        let nft_id = object::id(&nft);
        transfer::public_transfer(nft, tx_context::sender(ctx));
        event::emit(MintEvent { nft_id, name: std::string::utf8(name) });
    }
} 
