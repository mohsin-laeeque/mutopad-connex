import '@mutopad/connex-framework/dist/driver-interface'
import Deferred from './deferred'
import * as Helper from './helper'

const DEFAULT_TOS_URL = 'https://tos.vecha.in/'
const ACCEPTED_SUFFIX = '.accepted'
const RESP_SUFFIX = '.resp'

/** sign request relayed by tos */
type RelayedRequest = {
    type: 'tx' | 'cert'
    gid: string
    payload: {
        message: object
        options: object
    }
    nonce: string
}

/** sign response relayed by tos */
type RelayedResponse = {
    error?: string
    payload?: object
}

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}


async function submitRequest(rid: string, json: string, tosUrl: string, abort: Promise<never>) {
    const src = new URL(rid, tosUrl).href
    for (let i = 0; i < 3; i++) {
        try {
            return await Promise.race([
                abort,
                fetch(src, {
                    method: 'POST',
                    body: json,
                    headers: new Headers({
                        'Content-Type': 'application/json'
                    })
                })])
        } catch {
            await Promise.race([
                abort,
                sleep(2000)
            ])
        }
    }
    throw new Error('failed to submit request')
}

async function pollResponse(rid: string, suffix: string, timeout: number, tosUrl: string, abort: Promise<never>) {
    let errCount = 0
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        try {
            const resp = await Promise.race([
                abort,
                fetch(new URL(`${rid}${suffix}?wait=1`, tosUrl).href)
            ])
            const text = await Promise.race([
                abort,
                resp.text()
            ])
            if (text) {
                return text
            }
        } catch (err) {
            if (++errCount > 2) {
                throw new Error('failed fetch response')
            }
            await Promise.race([
                abort,
                sleep(3000)
            ])
        }
    }
    throw new Error('timeout')
}

let _abort: Deferred<never> | null = null

async function sign<T extends 'tx' | 'cert'>(
    type: T,
    msg: T extends 'tx' ? Connex.Vendor.TxMessage : Connex.Vendor.CertMessage,
    options: T extends 'tx' ? Connex.Driver.TxOptions : Connex.Driver.CertOptions,
    genesisId: string,
    mutopadId: string,
    nonce: () => string,
    blake2b256: (val: string) => string,
    tosUrl: string
): Promise<T extends 'tx' ? Connex.Vendor.TxResponse : Connex.Vendor.CertResponse> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (_abort) {
        _abort.reject(new Error('aborted'))
    }

    const abort = _abort = new Deferred<never>()

    const onAccepted = options.onAccepted
    const req: RelayedRequest = {
        type,
        gid: genesisId,
        payload: {
            message: msg,
            options: { ...options, onAccepted: undefined }
        },
        nonce: nonce()
    }
    // console.log("Param Request: " ,mutopadId)
    // console.log("Origional Request: " ,req)
    const json = JSON.stringify(req)
    const rid = blake2b256(json)
    const src = new URL(rid, tosUrl).href
    const helper = Helper.connect(src, mutopadId)

    let accepted = false

    try {
        // submit request and poll response
        await submitRequest(rid, json, tosUrl, abort)

        void (async () => {
            try {
                await Promise.race([
                    abort,
                    sleep(1500)
                ])
                !accepted && helper.show()
            // eslint-disable-next-line no-empty
            } catch { }
        })()

        void (async () => {
            try {
                await pollResponse(rid, ACCEPTED_SUFFIX, 60 * 1000, tosUrl, abort)
                accepted = true
                helper.hide()
                onAccepted && onAccepted()
            // eslint-disable-next-line no-empty
            } catch { }
        })()

        const respJson = await pollResponse(rid, RESP_SUFFIX, 10 * 60 * 1000, tosUrl, abort)
        const resp: RelayedResponse = JSON.parse(respJson)
        if (resp.error) {
            throw new Error(resp.error)
        }
        return resp.payload as any
    } finally {
        abort.reject(new Error('aborted'))
        helper.hide()
    }
}

/**
 * create an instance of wallet buddy to help send signing requests to wallet app
 * @param genesisId the genesis id of requests binding to
 * @param nonce random bytes generator
 * @param blake2b256 blake2b256 hash function
 * @param ext_id extention id from the extention
 * @param tosUrl the optional customized tos url
 */
export function create(
    genesisId: string,
    nonce: () => string,
    blake2b256: (val: string) => string,
    ext_id: string,
    tosUrl?: string
): Pick<Connex.Driver, 'signTx' | 'signCert'> {
    // console.log("Recivinig the extension ID: " + ext_id);
    return {
        signTx(msg: Connex.Vendor.TxMessage, options: Connex.Driver.TxOptions): Promise<Connex.Vendor.TxResponse> {
            return sign('tx', msg, options, genesisId, ext_id, nonce, blake2b256,tosUrl || DEFAULT_TOS_URL)
        },
        signCert(msg: Connex.Vendor.CertMessage, options: Connex.Driver.CertOptions): Promise<Connex.Vendor.CertResponse> {
            return sign('cert', msg, options, genesisId, ext_id , nonce, blake2b256, tosUrl || DEFAULT_TOS_URL,)
        }
    }
}
