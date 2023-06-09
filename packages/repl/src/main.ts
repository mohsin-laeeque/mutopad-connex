import { Framework } from '@mutopad/connex-framework'
import pkg from '@mutopad/connex-framework/package.json'
import { Driver, SimpleWallet, SimpleNet } from '@mutopad/connex-driver'
import * as REPL from 'repl'
import { resolve } from 'path'
import BigNumber from 'bignumber.js'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../package.json').version

process.on('unhandledRejection', reason => {
    //console.error('unhandled promise rejection', reason)
})

const baseUrl = process.argv[2] || 'http://localhost:8669/'

const networks: { [index: string]: string } = {
    '0x00000000851caf3cfdb6e899cf5958bfb1ac3413d346d43539627e6be7ec1b4a': 'Mainnet',
    '0x000000000b2bce3c70bc649a02749e8687721b09ed2e15997f466536b20bb127': 'Testnet',
    '0x00000000973ceb7f343a58b08f0693d6701a5fd354ff73d7058af3fba222aea4': 'Solo'
}

console.log(`VeChain Connex Playground v${version} @ ${baseUrl}`);

void (async () => {
    try {
        const wallet = new SimpleWallet()
        const driver = await Driver.connect(new SimpleNet(baseUrl), wallet)
        const connex = new Framework(Framework.guardDriver(driver))
        console.log(`framework v${pkg.version}`)

        const network = networks[connex.thor.genesis.id] || 'Custom'
        const prompter = {
            get text() {
                const progress = Math.floor(connex.thor.status.progress * 1000) / 10
                return `${network}(${progress}%)> `
            }
        }

        const txHistory = [] as object[]
        driver.onTxCommit = txObj => {
            txHistory.push(txObj)
        }

        const server = REPL.start({
            prompt: prompter.text,
            breakEvalOnSigint: true,
            useGlobal: true
        })
        setupREPL(server, {
            connex,
            thor: connex.thor,
            vendor: connex.vendor,
            wallet: {
                import(pk: string) { return wallet.import(pk) },
                remove(addr: string) { return wallet.remove(addr) },
                get list() { return wallet.list }
            },
            txParams: driver.txParams,
            txHistory,
            fromWei,
            toWei
        })

        const ticker = connex.thor.ticker()
        for (; ;) {
            server.setPrompt(prompter.text)
            await ticker.next()
        }
    } catch (err) {
        console.error(err)
        process.exit(1)
    }
})()


function setupREPL(server: REPL.REPLServer, obj: object) {
    Object.assign(server.context, obj)
    if (server.terminal) {
        const historyPath = resolve(process.env.HOME!, '.connex-repl_history')
        if ((server as any).setupHistory) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (server as any).setupHistory(historyPath, () => {/** */ })
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            require('repl.history')(server, historyPath)
        }
    }
    server.once('exit', () => {
        server.close()
        process.exit(0)
    })

    // override completer
    const originalCompleter = server.completer;
    (server as any).completer = (line: string, callback: Function) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (originalCompleter as any).call(server, line, (err: any, out: [string[], string]) => {
            if (err) {
                return callback(err)
            }
            line = line.trim()
            if (line) {
                callback(null, out)
            } else {
                // eslint-disable-next-line no-prototype-builtins
                callback(null, [out[0].filter(i => obj.hasOwnProperty(i)), out[1]])
            }
        })
    }
}

const e18 = new BigNumber(1e18)
function toWei(v: string | number) {
    return new BigNumber(v).times(e18).toString(10)
}

function fromWei(v: string | number) {
    return new BigNumber(v).div(e18).toString(10)
}
