import sql from "#core/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE payments_blockchain (
    id int53 PRIMARY KEY,
    name text NOT NULL UNIQUE,
    coin_id text NOT NULL UNIQUE,
    mnemonic text NOT NULL,
    password text,
    last_block int8 NOT NULL DEFAULT 0
);

CREATE TABLE payments_blockchain_bip44 (
    blockchain_id int53 NOT NULL REFERENCES payments_blockchain ( id ),
    account int8 NOT NULL,
    change boolean NOT NULL,
    address int8 NOT NULL,
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

CREATE FUNCTION payments_get_blockchain_bip44 (
    p_blockchain_id int8,
    p_account int8,
    p_change boolean
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        WITH next_address AS (
            INSERT INTO payments_blockchain_bip44 AS pb (
                blockchain_id,
                account,
                change,
                address
            )
            VALUES (
                p_blockchain_id,
                p_account,
                p_change,
                0
            )
            ON CONFLICT ( blockchain_id, account, change )
            DO UPDATE SET
                address = pb.address + 1
            RETURNING
                account,
                change,
                address
        )
        SELECT format(
            'm/44''/%s''/%s''/%s/%s',
            b.coin_id,
            na.account,
            na.change::int,
            na.address
        )
        FROM next_address AS na
        JOIN payments_blockchain AS b
            ON b.id = p_blockchain_id
    );
END;
$$;

`;
