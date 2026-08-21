import { AbiCoder } from "ethers";
import tronweb from "tronweb";
import CacheLru from "#core/cache/lru";

const BLOCKCHAIN_PROVIDERS = {
        "trongrid": {
            "apiKeyHeader": "tron-pro-api-key",
        },
    },
    BLOCKCHAINS = {
        "tron": {
            "name": "tron",
            "coinType": 195,
            "usdtContract": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "usddContract": "TXDk8mbtRbXeYuMNS83CfKPaYYT8XWv9Hz",
            "providers": {
                "trongrid": {
                    "id": "trongrid",
                    "url": "https://api.trongrid.io",
                },
            },
        },
        "tron/nile": {
            "name": "tron/nile",
            "coinType": 195,
            "usdtContract": "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
            "usddContract": "TYQF9cAeJ3Faq8QXpHxTcFco72DRCQbgFt",
            "providers": {
                "trongrid": {
                    "id": "trongrid",
                    "url": "https://nile.trongrid.io",
                },
            },
        },
        "tron/shasta": {
            "name": "tron/shasta",
            "coinType": 195,
            "usdtContract": null,
            "usddContract": null,
            "providers": {
                "trongrid": {
                    "id": "trongrid",
                    "url": "https://api.shasta.trongrid",
                },
            },
        },
    },
    CONTRACT_METHODS = {
        "transfer": [
            {
                "name": "toAddress",
                "type": "address",
            },
            {
                "name": "amount",
                "type": "uint256",
            },
        ],
    },
    METHOD_SIGNATURES = {};

for ( const name in CONTRACT_METHODS ) {
    const params = CONTRACT_METHODS[ name ],
        signature = tronweb.utils.crypto.sha3( `${ name }(${ params.map( param => param.type ).join( "," ) })` ).slice( 2, 10 ),
        names = params.map( param => param.name ),
        types = params.map( param => param.type );

    METHOD_SIGNATURES[ signature ] = {
        name,
        names,
        types,
    };
}

export default class Blockchain {
    #blockchain;
    #provider;
    #providerApiKey;
    #mnemonic;
    #password;
    #api;
    #cache = new CacheLru( { "maxSize": 1024 } );

    constructor ( { blockchain, provider, providerApiKey, mnemonic, password } ) {
        this.#blockchain = BLOCKCHAINS[ blockchain ];
        if ( !this.#blockchain ) throw new Error( "Blockchain is not supported" );

        this.#provider = this.#blockchain.providers[ provider ];
        if ( !this.#provider ) throw new Error( "Blockchain provider is not supported" );

        this.#providerApiKey = providerApiKey;
        this.#mnemonic = mnemonic;
        this.#password = password;

        this.#api = this.#createApi();
    }

    // static
    static generateMnemonic ( { password } = {} ) {
        return tronweb.utils.accounts.generateRandom( password ).mnemonic;
    }

    // public
    createAddress ( accountId, change, addressId ) {
        return {
            ...this.#createAddress( `m/44'/${ this.#blockchain.coinType }'/${ accountId }'/${ change
                ? 1
                : 0 }/${ addressId }` ),
            "privateKey": undefined,
        };
    }

    async getTransactions ( blockNumber ) {
        const res = await this.#api.trx.getBlockRange( blockNumber, blockNumber + 99 );

        return res;
    }

    decodeParams ( data ) {
        const signature = data.slice( 0, 8 ),
            method = METHOD_SIGNATURES[ signature ];

        if ( !method ) return;

        const coder = AbiCoder.defaultAbiCoder(),
            decodeTypes = method.types.map( type => {
                return type === "address"
                    ? "uint256"
                    : type;
            } ),
            values = coder.decode( decodeTypes, "0x" + data.slice( 8 ) );

        return {
            "name": method.name,
            "params": Object.fromEntries( values.map( ( value, i ) => {
                if ( method.types[ i ] === "address" ) {
                    const hex = BigInt( value ).toString( 16 ).padStart( 40, "0" );

                    value = tronweb.utils.address.fromHex( "41" + hex );
                }

                return [ method.names[ i ], value ];
            } ) ),
        };
    }

    // private
    #createApi ( { privateKey } = {} ) {
        return new tronweb.TronWeb( {
            "fullHost": this.#provider.url,
            "headers": BLOCKCHAIN_PROVIDERS[ this.#provider.id ].apiKeyHeader && this.#providerApiKey
                ? { [ BLOCKCHAIN_PROVIDERS[ this.#provider.id ].apiKeyHeader ]: this.#providerApiKey }
                : undefined,
            privateKey,
        } );
    }

    #createAddress ( address ) {
        const data = {
            "address": null,
            "bip44": null,
            "privateKey": null,
        };

        // address
        if ( this.#api.isAddress( address ) ) {
            data.address = address;
        }

        // bip44
        else if ( address.startsWith( "m/44'/195'/" ) ) {
            data.bip44 = address;

            address = this.#cache.get( data.bip44 );

            if ( address ) {
                data.privateKey = address.privateKey;
                data.address = address.address;
            }
            else {
                const account = this.#api.fromMnemonic( this.#mnemonic, data.bip44, this.#password );

                data.privateKey = account.privateKey;
                data.address = account.address;

                this.#cache.set( data.bip44, data );
            }
        }

        // private key
        else {
            data.address = this.#api.address.fromPrivateKey( address );
            data.privateKey = address;
        }

        return data;
    }
}
