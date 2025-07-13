module my_nft::my_nft_test {

    #[test_only]
    use sui::test_scenario;

    #[test_only]
    use my_nft::my_nft::{Self, AwesomeNFT, MintEvent};

    #[test_only]
    use sui::test_scenario::{Self as ts};

    #[test]
    fun test_mint_creates_nft_and_emits_event() {
        let sender_address = @0xCAFE;
        let test_scenario = ts::begin(sender_address);
        
        let name_bytes = b"test_nft";
        let description_bytes = b"test_description";
        let url_bytes = b"https://example.com";
        
        {
            my_nft::mint(
                name_bytes,
                description_bytes,
                url_bytes,
                ts::ctx(&mut test_scenario)
            );
        };
        
        ts::next_tx(&mut test_scenario, sender_address);
        
        {
            let minted_nft: AwesomeNFT = ts::take_from_sender(&test_scenario);
            
            assert!(minted_nft.name == std::string::utf8(name_bytes), 1000);
            assert!(minted_nft.description == std::string::utf8(description_bytes), 1001);
            assert!(minted_nft.url == sui::url::new_unsafe_from_bytes(url_bytes), 1002);
            
            ts::return_to_sender(&test_scenario, minted_nft);
        };
        
        let transaction_effects = ts::next_tx(&mut test_scenario, sender_address);
        assert!(ts::num_user_events(&transaction_effects) == 1, 1003);
        
        let emitted_event: MintEvent = ts::take_from_sender(&test_scenario);
        assert!(emitted_event.name == std::string::utf8(name_bytes), 1004);
        
        ts::return_to_sender(&test_scenario, emitted_event);
        
        ts::end(test_scenario);
    }
} 
