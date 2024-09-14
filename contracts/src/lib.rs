//! This a basic multi-sig account contract that with a customizable per-token
//! authorization policy.
//!
//! This demonstrates how to build the account contracts and how to use the
//! authorization context in order to implement custom authorization policies
//! that would govern all the account contract interactions.
#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec,
};
#[contract]
struct AccountContract;

#[contracttype]
#[derive(Clone)]
pub struct EthereumAddressSignature {
    pub address: BytesN<20>,
    pub signature: BytesN<65>,
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u32)]
pub enum Error {
    NotEnoughSigners = 1,
    NegativeAmount = 2,
    BadSignatureOrder = 3,
    UnknownSigner = 4,
    InvalidContext = 5,
    SignerMismatch = 6,
    AuthenticationFailed = 7,
    UnauthorizedSigner = 8,
}

const STORAGE_KEY_PK: Symbol = symbol_short!("pk");
const ETHEREUM_MESSAGE_PREFIX: &[u8] = b"\x19Ethereum Signed Message:\n32";
const ETHEREUM_MESSAGE_PREFIX_LEN: usize = 28;
const ETHEREUM_PREFIXED_MESSAGE_LEN: usize = 32 + ETHEREUM_MESSAGE_PREFIX_LEN;

fn public_key_to_address(env: &Env, public_key: &BytesN<65>) -> BytesN<20> {
    // Remove first byte to the public key before to hash
    let mut sliced_public_key: [u8; 64] = [0u8; 64];
    sliced_public_key.clone_from_slice(&public_key.to_array().as_slice()[1..65]);

    // Step 1: Hash the public key using keccak256
    let hash = env
        .crypto()
        .keccak256(&Bytes::from_array(env, &sliced_public_key));

    // Step 2: Take the last 20 bytes of the keccak256 hash
    let mut address_bytes = [0u8; 20];
    address_bytes.copy_from_slice(&hash.to_array().as_slice()[12..32]);

    // Step 3: Return a BytesN<20> type
    BytesN::from_array(env, &address_bytes)
}

fn split_ethereum_signature(env: &Env, signature: BytesN<65>) -> (u32, BytesN<64>) {
    let mut base_signature: [u8; 64] = [0u8; 64];
    base_signature.copy_from_slice(&signature.to_array().as_slice()[..64]);

    let recovery_id = signature.to_array()[64];

    (
        recovery_id.into(),
        BytesN::<64>::from_array(env, &base_signature),
    )
}

#[contractimpl]
impl AccountContract {
    pub fn extend_ttl(env: Env) {
        let max_ttl = env.storage().max_ttl();
        let contract_address = env.current_contract_address();

        env.storage().instance().extend_ttl(max_ttl, max_ttl);
        env.deployer()
            .extend_ttl(contract_address.clone(), max_ttl, max_ttl);
        env.deployer()
            .extend_ttl_for_code(contract_address.clone(), max_ttl, max_ttl);
        env.deployer()
            .extend_ttl_for_contract_instance(contract_address.clone(), max_ttl, max_ttl);
    }

    // Initialize the contract with a list of ed25519 public key ('signers').
    pub fn init(env: Env, signer: BytesN<20>) -> Result<(), Error> {
        env.storage().persistent().set(&STORAGE_KEY_PK, &signer);

        Self::extend_ttl(env);

        Ok(())
    }
}

#[contractimpl]
impl CustomAccountInterface for AccountContract {
    type Signature = EthereumAddressSignature;
    type Error = Error;

    // This is the 'entry point' of the account contract and every account
    // contract has to implement it. `require_auth` calls for the Address of
    // this contract will result in calling this `__check_auth` function with
    // the appropriate arguments.
    //
    // This should return `()` if authentication and authorization checks have
    // been passed and return an error (or panic) otherwise.
    //
    // `__check_auth` takes the payload that needed to be signed, arbitrarily
    // typed signatures (`Vec<AccSignature>` contract type here) and authorization
    // context that contains all the invocations that this call tries to verify.
    //
    // `__check_auth` has to authenticate the signatures. It also may use
    // `auth_context` to implement additional authorization policies (like token
    // spend limits here).
    //
    // Soroban host guarantees that `__check_auth` is only being called during
    // `require_auth` verification and hence this may mutate its own state
    // without the need for additional authorization (for example, this could
    // store per-time-period token spend limits instead of just enforcing the
    // limit per contract call).
    //
    // Note, that `__check_auth` function shouldn't call `require_auth` on the
    // contract's own address in order to avoid infinite recursion.
    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: EthereumAddressSignature,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let stored_address: BytesN<20> = env
            .storage()
            .persistent()
            .get(&STORAGE_KEY_PK)
            .ok_or(Error::UnknownSigner)?;

        // signature without recovery_id
        let (recovery_id, base_signature) = split_ethereum_signature(&env, signature.signature);

        // sha256(message)
        let preimage = Bytes::from(signature_payload.to_bytes());

        // keccack256(sha256(message))
        let auth_hash = env.crypto().keccak256(&preimage);

        let mut concatenated: [u8; ETHEREUM_PREFIXED_MESSAGE_LEN] =
            [0u8; ETHEREUM_PREFIXED_MESSAGE_LEN];

        concatenated[..ETHEREUM_MESSAGE_PREFIX_LEN].copy_from_slice(ETHEREUM_MESSAGE_PREFIX);

        concatenated[ETHEREUM_MESSAGE_PREFIX_LEN..ETHEREUM_PREFIXED_MESSAGE_LEN]
            .copy_from_slice(auth_hash.to_array().as_slice());

        // prefix_with_ethereum(keccack256(sha256(message)))
        let prefixed_message = Bytes::from_slice(&env, &concatenated);

        // keccack256(prefix_with_ethereum(keccack256(sha256(message))))
        let ethereum_payload = env.crypto().keccak256(&prefixed_message);

        if recovery_id < 27 || recovery_id > 28 {
            return Err(Error::SignerMismatch);
        }

        let public_key =
            env.crypto()
                .secp256k1_recover(&ethereum_payload, &base_signature, recovery_id - 27);

        let address = public_key_to_address(&env, &public_key);

        if address != signature.address {
            return Err(Error::SignerMismatch);
        }

        if address != stored_address {
            return Err(Error::UnauthorizedSigner);
        }

        Ok(())
    }
}

mod test;
