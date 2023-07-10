/* eslint-disable @typescript-eslint/no-unused-vars */
import { DriverNoVendor, SimpleNet } from '@mutopad/connex-driver'
import { loadLibrary } from './script-loader'
import type * as ConnexWalletBuddy from '@mutopad/connex-wallet-buddy'
import randomBytes from 'randombytes'
import { blake2b256 } from 'thor-devkit'

const BUDDY_SRC = 'https://unpkg.com/@mutopad/connex-wallet-buddy@0.0.18'
const BUDDY_LIB_NAME = 'ConnexWalletBuddy'

type ConnexSigner = Pick<Connex.Driver, 'signTx' | 'signCert'>
export type ExtensionSigner = {
    newConnexSigner: (genesisId: string) => ConnexSigner
}

export type MutopadSigner = {
    enable: () => Promise<string>
}

/** the driver implements vendor methods only */
export class DriverVendorOnly implements Connex.Driver {
    private readonly signer: Promise<ConnexSigner>
    constructor(genesisId: string, useExtension: boolean, ext_id?: string) {
        // console.log("extID passed to constructor: ",ext_id)
        this.signer = this.initSigner(genesisId, useExtension, ext_id)
    }
    get genesis(): Connex.Thor.Block { throw new Error('not implemented') }
    get head(): Connex.Thor.Status['head'] { throw new Error('not implemented') }
    pollHead(): Promise<Connex.Thor.Status['head']> { throw new Error('not implemented') }
    getBlock(revision: string | number): Promise<Connex.Thor.Block | null> { throw new Error('not implemented') }
    getTransaction(id: string, allowPending: boolean): Promise<Connex.Thor.Transaction | null> { throw new Error('not implemented') }
    getReceipt(id: string): Promise<Connex.Thor.Transaction.Receipt | null> { throw new Error('not implemented') }
    getAccount(addr: string, revision: string): Promise<Connex.Thor.Account> { throw new Error('not implemented') }
    getCode(addr: string, revision: string): Promise<Connex.Thor.Account.Code> { throw new Error('not implemented') }
    getStorage(addr: string, key: string, revision: string): Promise<Connex.Thor.Account.Storage> { throw new Error('not implemented') }
    explain(arg: Connex.Driver.ExplainArg, revision: string, cacheHints?: string[]): Promise<Connex.VM.Output[]> { throw new Error('not implemented') }
    filterEventLogs(arg: Connex.Driver.FilterEventLogsArg): Promise<Connex.Thor.Filter.Row<'event'>[]> { throw new Error('not implemented') }
    filterTransferLogs(arg: Connex.Driver.FilterTransferLogsArg): Promise<Connex.Thor.Filter.Row<'transfer'>[]> { throw new Error('not implemented') }

    signTx(msg: Connex.Vendor.TxMessage, options: Connex.Driver.TxOptions): Promise<Connex.Vendor.TxResponse> {
        return this.signer.then(b => b.signTx(msg, options))
    }
    signCert(msg: Connex.Vendor.CertMessage, options: Connex.Driver.CertOptions): Promise<Connex.Vendor.CertResponse> {
        return this.signer.then(b => b.signCert(msg, options))
    }

    private initSigner(genesisId: string, useExtension: boolean, ext_id?: string): Promise<ConnexSigner> {
        // console.log("initSigner called with " + ext_id);
        if (useExtension && !ext_id) {
            return Promise.resolve((window as Required<globalThis.Window>).vechain.newConnexSigner(genesisId))
        }

        return loadLibrary<typeof ConnexWalletBuddy>(
          BUDDY_SRC,
          BUDDY_LIB_NAME
        ).then(lib => lib.create(
            genesisId,
            () => randomBytes(16).toString('hex'),
            val => blake2b256(val).toString('hex'),
            ext_id
        ))
    }
}

/** fully implemented Connex.Driver */
class FullDriver extends DriverNoVendor {
    private readonly vd: DriverVendorOnly

    constructor(node: string, genesis: Connex.Thor.Block, useExtension: boolean, ext_id?: string) {
        // console.log("Constructing Vender Driver: ", ext_id, "useExtension", useExtension);
        super(new SimpleNet(node), genesis)
        this.vd = new DriverVendorOnly(genesis.id, useExtension, ext_id )
    }
    signTx(msg: Connex.Vendor.TxMessage, options: Connex.Driver.TxOptions): Promise<Connex.Vendor.TxResponse> {
        return this.vd.signTx(msg, options)
    }
    signCert(msg: Connex.Vendor.CertMessage, options: Connex.Driver.CertOptions): Promise<Connex.Vendor.CertResponse> {
        return this.vd.signCert(msg, options)
    }
}

const cache: Record<string, FullDriver> = {}

/**
 * create full driver
 * @param node the url of thor node
 * @param genesis the enforced genesis block
 */
export function createFull(node: string, genesis: Connex.Thor.Block, useExtension: boolean, ext_id?: string): Connex.Driver {
    const key = blake2b256(JSON.stringify({
        node,
        genesis,
        useExtension,
    })).toString('hex')

    let driver = cache[key]
    // console.log("Full created : ", useExtension, ext_id);
    if (!driver) {
        cache[key] = driver = new FullDriver(node, genesis, useExtension, ext_id)
    }
    return driver
}

