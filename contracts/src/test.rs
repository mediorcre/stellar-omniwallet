#![cfg(test)]
extern crate std;

use dotenv::dotenv;
use ed25519_dalek::Keypair;
use eyre::Result;
use rand::thread_rng;
use soroban_sdk::auth::ContractContext;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Bytes;
use soroban_sdk::Val;
use soroban_sdk::{auth::Context, vec, Address, BytesN, Env, IntoVal, Symbol};

use alloy::{
    hex::FromHex,
    primitives::{keccak256, B256},
    signers::{local::PrivateKeySigner as EthereumSigner, SignerSync},
};

use crate::Error;
use crate::EthereumAddressSignature;
use crate::{AccountContract, AccountContractClient, ETHEREUM_MESSAGE_PREFIX};

pub struct HashUtils {
    pub e: Env,
}

impl HashUtils {
    pub fn new(e: Env) -> Self {
        Self { e }
    }

    #[allow(unused)]
    pub fn from_string(&self, message: &str) -> BytesN<32> {
        self.from_bytes(message.as_bytes())
    }

    pub fn from_bytes(&self, message: &[u8]) -> BytesN<32> {
        let raw_payload = keccak256(message);
        let mut payload: [u8; 32] = [0u8; 32];
        payload.clone_from_slice(&raw_payload.as_slice());
        payload.into_val(&self.e)
    }

    #[allow(unused)]
    pub fn with_ethereum_prefix(&self, message: &str) -> BytesN<32> {
        let hashed_message = self.from_string(message);

        self.from_bytes(
            [
                ETHEREUM_MESSAGE_PREFIX,
                hashed_message.to_array().as_slice(),
            ]
            .concat()
            .as_slice(),
        )
    }

    pub fn with_ethereum_prefix_from_bytes(&self, message: &[u8], hash: bool) -> BytesN<32> {
        if hash {
            let hashed_message = self.from_bytes(message);
            self.from_bytes(
                [
                    ETHEREUM_MESSAGE_PREFIX,
                    hashed_message.to_array().as_slice(),
                ]
                .concat()
                .as_slice(),
            )
        } else {
            self.from_bytes([ETHEREUM_MESSAGE_PREFIX, message].concat().as_slice())
        }
    }
}

fn generate_keypair() -> Keypair {
    Keypair::generate(&mut thread_rng())
}

fn signer_public_key(e: &Env, signer: &Keypair) -> BytesN<32> {
    signer.public.to_bytes().into_val(e)
}

fn ethereum_signer_public_key(e: &Env, signer: &EthereumSigner) -> BytesN<65> {
    let public_key = signer.credential().verifying_key().to_encoded_point(false);
    let mut fixed_length_public_key: [u8; 65] = [0u8; 65];
    fixed_length_public_key.clone_from_slice(&public_key.as_bytes());

    fixed_length_public_key.into_val(e)
}

fn public_key_to_address(e: &Env, public_key: &BytesN<65>) -> BytesN<20> {
    // Remove first 4 bytes to the public key
    let public_key = public_key.to_array().as_slice()[1..65].to_vec();

    let mut sliced_public_key: [u8; 64] = [0u8; 64];
    sliced_public_key.clone_from_slice(&public_key);

    // Step 1: Hash the public key using keccak256
    let hash = e
        .crypto()
        .keccak256(&Bytes::from_array(e, &sliced_public_key));

    // Step 2: Take the last 20 bytes of the keccak256 hash
    let mut address_bytes = [0u8; 20];
    address_bytes.copy_from_slice(&hash.to_array().as_slice()[12..32]);

    // Step 3: Return a BytesN<20> type
    BytesN::from_array(e, &address_bytes)
}

fn create_account_contract(e: &Env) -> AccountContractClient {
    AccountContractClient::new(e, &e.register_contract(None, AccountContract {}))
}

fn ethereum_address_sign(e: &Env, signer: &EthereumSigner, payload: &BytesN<32>) -> Val {
    let payload: [u8; 32] = payload.clone().into();
    let payload_slice = payload.as_slice();
    let digest = B256::from_slice(payload_slice).clone();
    let signature = signer.sign_hash_sync(&digest).unwrap();

    let mut signature_bytes: [u8; 65] = [0u8; 65];

    signature_bytes.clone_from_slice(&signature.as_bytes());

    let signature = EthereumAddressSignature {
        address: public_key_to_address(e, &ethereum_signer_public_key(e, signer)),
        signature: signature_bytes.into_val(e),
    };

    signature.into_val(e)
}

fn token_auth_context(e: &Env, token_id: &Address, fn_name: Symbol, amount: i128) -> Context {
    Context::Contract(ContractContext {
        contract: token_id.clone(),
        fn_name,
        args: ((), (), amount).into_val(e),
    })
}

async fn get_ethereum_signer() -> Result<EthereumSigner> {
    dotenv().ok();

    let signer_private_key = std::env::var("SIGNER_PRIVATE_KEY").expect("Missing private key");

    let private_key = B256::from_hex(signer_private_key)?;

    let signer = EthereumSigner::from_bytes(&private_key)?;

    Ok(signer)
}

#[tokio::test]
async fn test_token_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let hash_utils = HashUtils::new(env.clone());

    let account_contract = create_account_contract(&env);

    let ethereum_signer = get_ethereum_signer().await.unwrap();

    let ethereum_signer_public_key = ethereum_signer_public_key(&env, &ethereum_signer);

    let ethereum_address = public_key_to_address(&env, &ethereum_signer_public_key);

    account_contract.init(&ethereum_address);

    // Raw message already hashed using sha256
    let raw_message =
        hex::decode("eb5afeca2ffd697329dc3454f38df97b2ce104819a1e523e388a96fb9d41a10d").unwrap();

    // Convert raw message into slice
    let mut message: [u8; 32] = [0u8; 32];
    message.copy_from_slice(&raw_message.as_slice());

    // Bytes representation of sha256(message)
    let raw_payload = BytesN::<32>::from_array(&env, &message);

    // keccack256(sha256(message))
    let hashed_message = hash_utils.from_bytes(message.as_slice());

    // Compose the ethereum payload by hashing again the input
    // keccack256(prefix_with_ethereum(keccack256(sha256(message))))
    let ethereum_payload =
        hash_utils.with_ethereum_prefix_from_bytes(&hashed_message.to_array().as_slice(), false);

    let token = Address::generate(&env);

    let signature_val = ethereum_address_sign(&env, &ethereum_signer, &ethereum_payload);

    env.try_invoke_contract_check_auth::<Error>(
        &account_contract.address,
        &raw_payload,
        signature_val.clone(),
        &vec![
            &env,
            token_auth_context(&env, &token, Symbol::new(&env, "transfer"), 1000),
        ],
    )
    .unwrap();
}
