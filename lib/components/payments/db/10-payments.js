import sql from "#core/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE payments_blockchain (
    id int53 PRIMARY KEY,
    name text NOT NULL UNIQUE,
    coin_id text NOT NULL UNIQUE,
    mnemonic text NOT NULL,
    password text,
    last_block int8 NOT NULL DEFAULT 0
);

CREATE TABLE payments_blockchain_bip44 (
    blockchain int53 NOT NULL REFERENCES payments_blockchain ( id ),
    account int8 NOT NULL DEFAILT 0,
    change int8 NOT NULL DEFAULT 0,
    address int8 NOT NULL DEFAULT 0,
    UNIQUE ( blockchain, account, change )
);

CREATE TABLE payments_blockchain_account (
    id int53 PRIMARY KEY,
    blockchain int53 NOT NULL REFERENCES payments_blockchain ( id ),
    account text NOT NULL,
    bip44 text NOT NULL,

    -- XXX autoupdate on transaction
    amount numeric NOT NULL DEFAULT 0,

    UNIQUE ( blockchain, base58 ),
    UNIQUE ( blockchain, bip44 )
);

CREATE TABLE payments_blockchain_transaction (
    id int53 PRIMARY KEY,
    blockchain int53 NOT NULL REFERENCES payments_blockchain ( id ),

    -- XXX
    currency text NOT NULL,


    -- XXX can be external accounts
    from_account int53 NOT NULL REFERENCES payments_blockchain_account ( id ),
    to_account int53 NOT NULL REFERENCES payments_blockchain_account ( id ),
    txid text NOT NULL,
    amount numeric NOT NULL,
    status text NOT NULL,
    UNIQUE ( blockchain, txid ),
);

`;
